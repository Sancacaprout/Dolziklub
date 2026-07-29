-- Le Tribunal: private collective voting editions with resumable answers,
-- anonymous revealed results and an admin-controlled lifecycle.

create table public.tribunal_sessions (
  id bigint generated always as identity primary key,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'results_revealed')),
  opens_at timestamptz,
  closes_at timestamptz,
  results_revealed_at timestamptz,
  created_by uuid references public.member_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at >= opens_at),
  check (results_revealed_at is null or closes_at is not null)
);

create unique index tribunal_one_open_session_idx
  on public.tribunal_sessions (status)
  where status = 'open';
create index tribunal_sessions_created_idx
  on public.tribunal_sessions (created_at desc);

create table public.tribunal_questions (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.tribunal_sessions(id) on delete cascade,
  position smallint not null check (position between 1 and 64),
  prompt text not null check (char_length(btrim(prompt)) between 3 and 500),
  type text not null check (type in ('member', 'member_text', 'album', 'review')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, position),
  unique (id, session_id)
);

create index tribunal_questions_session_active_idx
  on public.tribunal_questions (session_id, is_active, position);

create table public.tribunal_session_participants (
  session_id bigint not null references public.tribunal_sessions(id) on delete cascade,
  participant_id uuid not null references public.member_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, participant_id)
);

create index tribunal_participants_member_session_idx
  on public.tribunal_session_participants (participant_id, session_id);

create table public.tribunal_responses (
  id bigint generated always as identity primary key,
  session_id bigint not null,
  question_id bigint not null,
  respondent_participant_id uuid not null default auth.uid(),
  target_participant_id uuid,
  target_album_id uuid references public.club_draw_entries(id) on delete restrict,
  target_review_id uuid references public.member_album_reviews(id) on delete restrict,
  free_text text check (free_text is null or char_length(btrim(free_text)) between 1 and 160),
  is_hidden boolean not null default false,
  hidden_at timestamptz,
  hidden_by uuid references public.member_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, question_id, respondent_participant_id),
  foreign key (question_id, session_id)
    references public.tribunal_questions(id, session_id) on delete cascade,
  foreign key (session_id, respondent_participant_id)
    references public.tribunal_session_participants(session_id, participant_id) on delete cascade,
  foreign key (session_id, target_participant_id)
    references public.tribunal_session_participants(session_id, participant_id) on delete restrict,
  check ((is_hidden and hidden_at is not null and hidden_by is not null) or (not is_hidden and hidden_at is null and hidden_by is null))
);

create index tribunal_responses_respondent_session_idx
  on public.tribunal_responses (respondent_participant_id, session_id);
create index tribunal_responses_question_target_member_idx
  on public.tribunal_responses (session_id, question_id, target_participant_id)
  where target_participant_id is not null and not is_hidden;
create index tribunal_responses_question_target_album_idx
  on public.tribunal_responses (session_id, question_id, target_album_id)
  where target_album_id is not null and not is_hidden;
create index tribunal_responses_question_target_review_idx
  on public.tribunal_responses (session_id, question_id, target_review_id)
  where target_review_id is not null and not is_hidden;

create or replace function private.touch_tribunal_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_tribunal_row() from public, anon, authenticated;

create trigger touch_tribunal_sessions
  before update on public.tribunal_sessions
  for each row execute function private.touch_tribunal_row();
create trigger touch_tribunal_questions
  before update on public.tribunal_questions
  for each row execute function private.touch_tribunal_row();
create trigger touch_tribunal_responses
  before update on public.tribunal_responses
  for each row execute function private.touch_tribunal_row();

create or replace function private.can_access_tribunal_session(p_session_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_member_admin())
    or exists (
      select 1
      from public.tribunal_session_participants participant
      join public.tribunal_sessions session on session.id = participant.session_id
      where participant.session_id = p_session_id
        and participant.participant_id = (select auth.uid())
        and session.status <> 'draft'
    );
$$;

revoke all on function private.can_access_tribunal_session(bigint) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.can_access_tribunal_session(bigint) to authenticated;

create or replace function private.validate_tribunal_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  question_record record;
  text_limit integer;
begin
  if caller_id is null then
    raise exception 'Authentification requise';
  end if;
  if new.respondent_participant_id <> caller_id then
    raise exception 'Impossible de répondre à la place d’un autre membre';
  end if;
  if tg_op = 'UPDATE' and (
    new.session_id <> old.session_id
    or new.question_id <> old.question_id
    or new.respondent_participant_id <> old.respondent_participant_id
  ) then
    raise exception 'La session, la question et le répondant sont immuables';
  end if;

  select question.type, question.config, question.is_active,
         session.status, session.opens_at, session.closes_at
  into question_record
  from public.tribunal_questions question
  join public.tribunal_sessions session on session.id = question.session_id
  where question.id = new.question_id
    and question.session_id = new.session_id;

  if not found or not question_record.is_active then
    raise exception 'Cette question n’est pas disponible';
  end if;
  if question_record.status <> 'open'
     or (question_record.opens_at is not null and question_record.opens_at > now())
     or (question_record.closes_at is not null and question_record.closes_at <= now()) then
    raise exception 'Cette édition du Tribunal n’accepte plus de réponse';
  end if;
  if not exists (
    select 1 from public.tribunal_session_participants participant
    where participant.session_id = new.session_id
      and participant.participant_id = caller_id
  ) then
    raise exception 'Tu ne participes pas à cette édition';
  end if;

  new.free_text := nullif(btrim(new.free_text), '');
  new.is_hidden := case when tg_op = 'UPDATE' then old.is_hidden else false end;
  new.hidden_at := case when tg_op = 'UPDATE' then old.hidden_at else null end;
  new.hidden_by := case when tg_op = 'UPDATE' then old.hidden_by else null end;

  if question_record.type = 'member' then
    if new.target_participant_id is null
       or new.target_participant_id = caller_id
       or new.target_album_id is not null
       or new.target_review_id is not null
       or new.free_text is not null then
      raise exception 'Choisis un autre membre pour cette question';
    end if;
  elsif question_record.type = 'member_text' then
    text_limit := least(160, greatest(1, coalesce((question_record.config ->> 'maxLength')::integer, 160)));
    if new.target_participant_id is null
       or new.target_participant_id = caller_id
       or new.target_album_id is not null
       or new.target_review_id is not null
       or new.free_text is null
       or char_length(new.free_text) > text_limit then
      raise exception 'Choisis un autre membre et respecte la limite du texte';
    end if;
  elsif question_record.type = 'album' then
    if new.target_album_id is null
       or new.target_participant_id is not null
       or new.target_review_id is not null
       or new.free_text is not null
       or not exists (
         select 1
         from public.club_draw_entries entry
         join public.club_draws draw on draw.draw_number = entry.draw_number
         where entry.id = new.target_album_id
           and draw.status in ('published', 'locked')
           and entry.album_title is not null
           and entry.album_artist is not null
       ) then
      raise exception 'Choisis un album réellement proposé dans le club';
    end if;
  elsif question_record.type = 'review' then
    if new.target_review_id is null
       or new.target_participant_id is not null
       or new.target_album_id is not null
       or new.free_text is not null
       or not exists (
         select 1
         from public.member_album_reviews review
         join public.club_draw_entries entry on entry.id::text = review.album_id
         join public.club_draws draw on draw.draw_number = entry.draw_number
         where review.id = new.target_review_id
           and draw.status in ('published', 'locked')
           and entry.album_title is not null
           and entry.album_artist is not null
       ) then
      raise exception 'Choisis une note réelle du tableur';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_tribunal_response() from public, anon, authenticated;

create trigger validate_tribunal_response
  before insert or update of session_id, question_id, respondent_participant_id,
    target_participant_id, target_album_id, target_review_id, free_text
  on public.tribunal_responses
  for each row execute function private.validate_tribunal_response();

alter table public.tribunal_sessions enable row level security;
alter table public.tribunal_questions enable row level security;
alter table public.tribunal_session_participants enable row level security;
alter table public.tribunal_responses enable row level security;

revoke all on table public.tribunal_sessions from anon, authenticated;
revoke all on table public.tribunal_questions from anon, authenticated;
revoke all on table public.tribunal_session_participants from anon, authenticated;
revoke all on table public.tribunal_responses from anon, authenticated;

grant select on table public.tribunal_sessions to authenticated;
grant select on table public.tribunal_questions to authenticated;
grant select on table public.tribunal_session_participants to authenticated;
grant select, insert on table public.tribunal_responses to authenticated;
grant update (target_participant_id, target_album_id, target_review_id, free_text)
  on table public.tribunal_responses to authenticated;

create policy "Members read accessible tribunal sessions"
  on public.tribunal_sessions for select to authenticated
  using ((select private.can_access_tribunal_session(id)));

create policy "Members read accessible tribunal questions"
  on public.tribunal_questions for select to authenticated
  using (
    (is_active or (select private.is_member_admin()))
    and (select private.can_access_tribunal_session(session_id))
  );

create policy "Members read participants in accessible tribunal sessions"
  on public.tribunal_session_participants for select to authenticated
  using ((select private.can_access_tribunal_session(session_id)));

create policy "Members read only their tribunal responses"
  on public.tribunal_responses for select to authenticated
  using (
    respondent_participant_id = (select auth.uid())
    or (select private.is_member_admin())
  );

create policy "Members create only their tribunal responses"
  on public.tribunal_responses for insert to authenticated
  with check (
    respondent_participant_id = (select auth.uid())
    and (select private.can_access_tribunal_session(session_id))
  );

create policy "Members update only their tribunal responses"
  on public.tribunal_responses for update to authenticated
  using (respondent_participant_id = (select auth.uid()))
  with check (respondent_participant_id = (select auth.uid()));

create or replace function private.seed_tribunal_questions(p_session_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.tribunal_questions (session_id, position, prompt, type, config)
  values
    (p_session_id, 1, 'Qui a les goûts musicaux les plus merdiques ?', 'member', '{}'::jsonb),
    (p_session_id, 2, 'Qui mérite qu’on lui retire définitivement le droit de proposer un album ?', 'member', '{}'::jsonb),
    (p_session_id, 3, 'Qui met les notes les plus débiles ?', 'member', '{}'::jsonb),
    (p_session_id, 4, 'Qui a le plus de chances de mettre 5/5 à une énorme merde ?', 'member', '{}'::jsonb),
    (p_session_id, 5, 'Qui a les goûts les plus fades ?', 'member', '{}'::jsonb),
    (p_session_id, 6, 'Qui se prend le plus pour un critique alors qu’il raconte n’importe quoi ?', 'member', '{}'::jsonb),
    (p_session_id, 7, 'Qui propose toujours des albums que personne n’a envie d’écouter ?', 'member', '{}'::jsonb),
    (p_session_id, 8, 'Qui écoute probablement ses albums en faisant autre chose et invente son avis après ?', 'member', '{}'::jsonb),
    (p_session_id, 9, 'Qui donnerait une mauvaise note juste parce qu’il n’aime pas la tête de l’artiste ?', 'member', '{}'::jsonb),
    (p_session_id, 10, 'Qui met le plus sa vie à noter un album ?', 'member', '{}'::jsonb),
    (p_session_id, 11, 'Qui a le plus souvent un avis totalement à chier ?', 'member', '{}'::jsonb),
    (p_session_id, 12, 'À qui ne confierais-tu jamais l’enceinte pendant une soirée ?', 'member', '{}'::jsonb),
    (p_session_id, 13, 'Termine la phrase : « Les goûts de ___ ressemblent à ___ »', 'member_text', '{"maxLength":160,"placeholder":"un vieux disque rayé…","template":"Les goûts de {member} ressemblent à {text}"}'::jsonb),
    (p_session_id, 14, 'Quelle proposition t’a fait perdre foi dans le groupe ?', 'album', '{}'::jsonb),
    (p_session_id, 15, 'Insulte musicalement un membre en une phrase.', 'member_text', '{"maxLength":160,"placeholder":"160 caractères pour régler tes comptes."}'::jsonb),
    (p_session_id, 16, 'Quelle note du tableur devrait faire l’objet d’une enquête ?', 'review', '{}'::jsonb)
  on conflict (session_id, position) do nothing;
$$;

revoke all on function private.seed_tribunal_questions(bigint) from public, anon, authenticated;

do $$
declare
  first_session_id bigint;
begin
  select id into first_session_id
  from public.tribunal_sessions
  where title = 'Le Tribunal — Édition 01'
  order by id
  limit 1;

  if first_session_id is null then
    insert into public.tribunal_sessions (title, status, opens_at, created_by)
    values (
      'Le Tribunal — Édition 01',
      'open',
      now(),
      (select id from public.member_profiles where role = 'admin' order by created_at limit 1)
    )
    returning id into first_session_id;
  end if;

  perform private.seed_tribunal_questions(first_session_id);
  insert into public.tribunal_session_participants (session_id, participant_id)
  select first_session_id, profile.id
  from public.member_profiles profile
  on conflict (session_id, participant_id) do nothing;
end;
$$;

create or replace function public.get_tribunal_context(p_session_id bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_is_admin boolean;
  selected_session public.tribunal_sessions%rowtype;
  payload jsonb;
begin
  if caller_id is null or not exists (select 1 from public.member_profiles where id = caller_id) then
    raise exception 'Authentification membre requise';
  end if;
  caller_is_admin := (select private.is_member_admin());

  if p_session_id is not null then
    select * into selected_session
    from public.tribunal_sessions session
    where session.id = p_session_id
      and (
        caller_is_admin
        or (
          session.status <> 'draft'
          and exists (
            select 1 from public.tribunal_session_participants participant
            where participant.session_id = session.id
              and participant.participant_id = caller_id
          )
        )
      );
  elsif caller_is_admin then
    select * into selected_session
    from public.tribunal_sessions
    order by created_at desc, id desc
    limit 1;
  else
    select session.* into selected_session
    from public.tribunal_sessions session
    join public.tribunal_session_participants participant on participant.session_id = session.id
    where participant.participant_id = caller_id
      and session.status <> 'draft'
    order by
      case session.status when 'open' then 0 when 'closed' then 1 else 2 end,
      session.created_at desc,
      session.id desc
    limit 1;
  end if;

  if selected_session.id is null then
    return jsonb_build_object(
      'session', null,
      'sessions', '[]'::jsonb,
      'questions', '[]'::jsonb,
      'participants', '[]'::jsonb,
      'albums', '[]'::jsonb,
      'reviews', '[]'::jsonb,
      'moderation', '[]'::jsonb,
      'isAdmin', caller_is_admin,
      'viewerId', caller_id
    );
  end if;

  select jsonb_build_object(
    'viewerId', caller_id,
    'isAdmin', caller_is_admin,
    'session', jsonb_build_object(
      'id', selected_session.id,
      'title', selected_session.title,
      'status', selected_session.status,
      'opensAt', selected_session.opens_at,
      'closesAt', selected_session.closes_at,
      'resultsRevealedAt', selected_session.results_revealed_at,
      'questionCount', (
        select count(*) from public.tribunal_questions question
        where question.session_id = selected_session.id and question.is_active
      ),
      'completedCount', (
        select count(*) from public.tribunal_responses response
        join public.tribunal_questions question on question.id = response.question_id
        where response.session_id = selected_session.id
          and response.respondent_participant_id = caller_id
          and question.is_active
      ),
      'participantCount', (
        select count(*) from public.tribunal_session_participants participant
        where participant.session_id = selected_session.id
      ),
      'participationCount', (
        select count(distinct response.respondent_participant_id)
        from public.tribunal_responses response
        where response.session_id = selected_session.id
      )
    ),
    'sessions', case when caller_is_admin then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', session.id,
        'title', session.title,
        'status', session.status,
        'createdAt', session.created_at,
        'participationCount', (
          select count(distinct response.respondent_participant_id)
          from public.tribunal_responses response
          where response.session_id = session.id
        )
      ) order by session.created_at desc, session.id desc)
      from public.tribunal_sessions session
    ), '[]'::jsonb) else '[]'::jsonb end,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', question.id,
        'position', question.position,
        'prompt', question.prompt,
        'type', question.type,
        'config', question.config,
        'isActive', question.is_active,
        'answer', (
          select jsonb_build_object(
            'id', response.id,
            'targetParticipantId', response.target_participant_id,
            'targetAlbumId', response.target_album_id,
            'targetReviewId', response.target_review_id,
            'freeText', response.free_text
          )
          from public.tribunal_responses response
          where response.session_id = selected_session.id
            and response.question_id = question.id
            and response.respondent_participant_id = caller_id
        )
      ) order by question.position)
      from public.tribunal_questions question
      where question.session_id = selected_session.id
        and (question.is_active or caller_is_admin)
    ), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id,
        'username', profile.username,
        'displayName', profile.display_name,
        'avatarPath', public_profile.avatar_path,
        'avatarUpdatedAt', public_profile.updated_at
      ) order by profile.display_name, profile.username)
      from public.tribunal_session_participants participant
      join public.member_profiles profile on profile.id = participant.participant_id
      left join public.member_public_profiles public_profile on public_profile.id = profile.id
      where participant.session_id = selected_session.id
    ), '[]'::jsonb),
    'albums', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entry.id,
        'title', entry.album_title,
        'artist', entry.album_artist,
        'proposedBy', entry.proposed_by_name,
        'drawNumber', entry.draw_number,
        'coverPath', entry.cover_path,
        'coverSourceUrl', entry.cover_source_url
      ) order by entry.draw_number desc, entry.position)
      from public.club_draw_entries entry
      join public.club_draws draw on draw.draw_number = entry.draw_number
      where draw.status in ('published', 'locked')
        and entry.album_title is not null
        and entry.album_artist is not null
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', review.id,
        'albumId', entry.id,
        'albumTitle', entry.album_title,
        'artist', entry.album_artist,
        'memberId', reviewer.id,
        'memberName', reviewer.display_name,
        'rating', review.rating,
        'reviewTitle', review.review_title,
        'reviewExcerpt', left(review.review, 240),
        'drawNumber', entry.draw_number
      ) order by entry.draw_number desc, entry.position)
      from public.member_album_reviews review
      join public.club_draw_entries entry on entry.id::text = review.album_id
      join public.club_draws draw on draw.draw_number = entry.draw_number
      join public.member_profiles reviewer on reviewer.id = review.member_id
      where draw.status in ('published', 'locked')
        and entry.album_title is not null
        and entry.album_artist is not null
    ), '[]'::jsonb),
    'moderation', case when caller_is_admin then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', response.id,
        'questionPosition', question.position,
        'questionPrompt', question.prompt,
        'targetDisplayName', target.display_name,
        'freeText', response.free_text,
        'isHidden', response.is_hidden,
        'updatedAt', response.updated_at
      ) order by response.updated_at desc)
      from public.tribunal_responses response
      join public.tribunal_questions question on question.id = response.question_id
      left join public.member_profiles target on target.id = response.target_participant_id
      where response.session_id = selected_session.id
        and response.free_text is not null
    ), '[]'::jsonb) else '[]'::jsonb end
  ) into payload;

  return payload;
end;
$$;

create or replace function public.save_my_tribunal_response(
  p_session_id bigint,
  p_question_id bigint,
  p_target_participant_id uuid default null,
  p_target_album_id uuid default null,
  p_target_review_id uuid default null,
  p_free_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  saved_response public.tribunal_responses%rowtype;
begin
  if caller_id is null or not exists (select 1 from public.member_profiles where id = caller_id) then
    raise exception 'Authentification membre requise';
  end if;

  insert into public.tribunal_responses (
    session_id,
    question_id,
    respondent_participant_id,
    target_participant_id,
    target_album_id,
    target_review_id,
    free_text
  ) values (
    p_session_id,
    p_question_id,
    caller_id,
    p_target_participant_id,
    p_target_album_id,
    p_target_review_id,
    p_free_text
  )
  on conflict (session_id, question_id, respondent_participant_id) do update
  set target_participant_id = excluded.target_participant_id,
      target_album_id = excluded.target_album_id,
      target_review_id = excluded.target_review_id,
      free_text = excluded.free_text
  returning * into saved_response;

  return jsonb_build_object(
    'id', saved_response.id,
    'targetParticipantId', saved_response.target_participant_id,
    'targetAlbumId', saved_response.target_album_id,
    'targetReviewId', saved_response.target_review_id,
    'freeText', saved_response.free_text,
    'updatedAt', saved_response.updated_at
  );
end;
$$;

create or replace function public.get_tribunal_results(p_session_id bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_is_admin boolean;
  selected_session public.tribunal_sessions%rowtype;
  question_record record;
  total_votes integer;
  ranking jsonb;
  free_answers jsonb;
  question_results jsonb := '[]'::jsonb;
  global_ranking jsonb;
begin
  if caller_id is null or not exists (select 1 from public.member_profiles where id = caller_id) then
    raise exception 'Authentification membre requise';
  end if;
  caller_is_admin := (select private.is_member_admin());

  select session.* into selected_session
  from public.tribunal_sessions session
  where (p_session_id is null or session.id = p_session_id)
    and (
      caller_is_admin
      or exists (
        select 1 from public.tribunal_session_participants participant
        where participant.session_id = session.id
          and participant.participant_id = caller_id
      )
    )
  order by session.created_at desc, session.id desc
  limit 1;

  if selected_session.id is null then
    raise exception 'Édition introuvable';
  end if;
  if selected_session.status <> 'results_revealed' and not caller_is_admin then
    raise exception 'Les résultats ne sont pas encore révélés';
  end if;

  for question_record in
    select * from public.tribunal_questions
    where session_id = selected_session.id and is_active
    order by position
  loop
    select count(*) into total_votes
    from public.tribunal_responses response
    where response.session_id = selected_session.id
      and response.question_id = question_record.id
      and not response.is_hidden;

    if question_record.type in ('member', 'member_text') then
      select coalesce(jsonb_agg(item order by votes desc, label), '[]'::jsonb)
      into ranking
      from (
        select
          profile.display_name as label,
          count(*)::integer as votes,
          jsonb_build_object(
            'kind', 'member',
            'id', profile.id,
            'label', profile.display_name,
            'username', profile.username,
            'votes', count(*),
            'percentage', coalesce(round(count(*) * 100.0 / nullif(total_votes, 0), 1), 0)
          ) as item
        from public.tribunal_responses response
        join public.member_profiles profile on profile.id = response.target_participant_id
        where response.session_id = selected_session.id
          and response.question_id = question_record.id
          and not response.is_hidden
        group by profile.id, profile.display_name, profile.username
        order by votes desc, label
        limit 3
      ) ranked;
    elsif question_record.type = 'album' then
      select coalesce(jsonb_agg(item order by votes desc, label), '[]'::jsonb)
      into ranking
      from (
        select
          entry.album_title as label,
          count(*)::integer as votes,
          jsonb_build_object(
            'kind', 'album',
            'id', entry.id,
            'label', entry.album_title,
            'artist', entry.album_artist,
            'proposedBy', entry.proposed_by_name,
            'drawNumber', entry.draw_number,
            'votes', count(*),
            'percentage', coalesce(round(count(*) * 100.0 / nullif(total_votes, 0), 1), 0)
          ) as item
        from public.tribunal_responses response
        join public.club_draw_entries entry on entry.id = response.target_album_id
        where response.session_id = selected_session.id
          and response.question_id = question_record.id
          and not response.is_hidden
        group by entry.id, entry.album_title, entry.album_artist, entry.proposed_by_name, entry.draw_number
        order by votes desc, label
        limit 3
      ) ranked;
    else
      select coalesce(jsonb_agg(item order by votes desc, label), '[]'::jsonb)
      into ranking
      from (
        select
          entry.album_title as label,
          count(*)::integer as votes,
          jsonb_build_object(
            'kind', 'review',
            'id', review.id,
            'label', entry.album_title,
            'artist', entry.album_artist,
            'memberName', reviewer.display_name,
            'rating', review.rating,
            'reviewTitle', review.review_title,
            'reviewExcerpt', left(review.review, 240),
            'drawNumber', entry.draw_number,
            'votes', count(*),
            'percentage', coalesce(round(count(*) * 100.0 / nullif(total_votes, 0), 1), 0)
          ) as item
        from public.tribunal_responses response
        join public.member_album_reviews review on review.id = response.target_review_id
        join public.club_draw_entries entry on entry.id::text = review.album_id
        join public.member_profiles reviewer on reviewer.id = review.member_id
        where response.session_id = selected_session.id
          and response.question_id = question_record.id
          and not response.is_hidden
        group by review.id, entry.id, entry.album_title, entry.album_artist,
          reviewer.display_name, review.rating, review.review_title, review.review,
          entry.draw_number
        order by votes desc, label
        limit 3
      ) ranked;
    end if;

    if question_record.type = 'member_text' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'targetDisplayName', target.display_name,
        'text', response.free_text
      ) order by response.id), '[]'::jsonb)
      into free_answers
      from public.tribunal_responses response
      left join public.member_profiles target on target.id = response.target_participant_id
      where response.session_id = selected_session.id
        and response.question_id = question_record.id
        and response.free_text is not null
        and not response.is_hidden;
    else
      free_answers := '[]'::jsonb;
    end if;

    question_results := question_results || jsonb_build_array(jsonb_build_object(
      'id', question_record.id,
      'position', question_record.position,
      'prompt', question_record.prompt,
      'type', question_record.type,
      'totalVotes', total_votes,
      'ranking', ranking,
      'freeAnswers', free_answers
    ));
  end loop;

  select coalesce(jsonb_agg(item order by citations desc, label), '[]'::jsonb)
  into global_ranking
  from (
    select
      target.display_name as label,
      count(*)::integer as citations,
      jsonb_build_object(
        'id', target.id,
        'label', target.display_name,
        'username', target.username,
        'citations', count(*)
      ) as item
    from public.tribunal_responses response
    join public.tribunal_questions question on question.id = response.question_id
    join public.member_profiles target on target.id = response.target_participant_id
    where response.session_id = selected_session.id
      and question.type in ('member', 'member_text')
      and not response.is_hidden
    group by target.id, target.display_name, target.username
    order by citations desc, label
  ) global_votes;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', selected_session.id,
      'title', selected_session.title,
      'status', selected_session.status,
      'resultsRevealedAt', selected_session.results_revealed_at
    ),
    'questions', question_results,
    'globalRanking', global_ranking
  );
end;
$$;

create or replace function public.admin_create_tribunal_session(
  p_title text,
  p_opens_at timestamptz default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  created_session_id bigint;
begin
  if caller_id is null or not (select private.is_member_admin()) then
    raise exception 'Accès administrateur requis';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 120 then
    raise exception 'Le titre doit contenir entre 3 et 120 caractères';
  end if;

  insert into public.tribunal_sessions (title, status, opens_at, created_by)
  values (btrim(p_title), 'draft', p_opens_at, caller_id)
  returning id into created_session_id;

  perform private.seed_tribunal_questions(created_session_id);
  insert into public.tribunal_session_participants (session_id, participant_id)
  select created_session_id, profile.id from public.member_profiles profile
  on conflict (session_id, participant_id) do nothing;

  return created_session_id;
end;
$$;

create or replace function public.admin_set_tribunal_session_status(
  p_session_id bigint,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  current_status text;
begin
  if caller_id is null or not (select private.is_member_admin()) then
    raise exception 'Accès administrateur requis';
  end if;
  if p_status not in ('open', 'closed', 'results_revealed') then
    raise exception 'Statut administratif invalide';
  end if;

  select status into current_status
  from public.tribunal_sessions
  where id = p_session_id
  for update;
  if current_status is null then raise exception 'Édition introuvable'; end if;
  if not (
    (current_status = 'draft' and p_status = 'open')
    or (current_status = 'open' and p_status = 'closed')
    or (current_status = 'closed' and p_status = 'results_revealed')
  ) then
    raise exception 'Transition de statut interdite';
  end if;

  if p_status = 'open' then
    insert into public.tribunal_session_participants (session_id, participant_id)
    select p_session_id, profile.id from public.member_profiles profile
    on conflict (session_id, participant_id) do nothing;
    update public.tribunal_sessions
    set status = 'open', opens_at = coalesce(opens_at, now()), closes_at = null,
        results_revealed_at = null
    where id = p_session_id;
  elsif p_status = 'closed' then
    update public.tribunal_sessions
    set status = 'closed', closes_at = now(), results_revealed_at = null
    where id = p_session_id;
  else
    update public.tribunal_sessions
    set status = 'results_revealed', results_revealed_at = now()
    where id = p_session_id;
  end if;

  return p_status;
end;
$$;

create or replace function public.admin_set_tribunal_question_active(
  p_question_id bigint,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_member_admin()) then
    raise exception 'Accès administrateur requis';
  end if;
  update public.tribunal_questions
  set is_active = p_is_active
  where id = p_question_id;
  if not found then raise exception 'Question introuvable'; end if;
  return p_is_active;
end;
$$;

create or replace function public.admin_set_tribunal_response_hidden(
  p_response_id bigint,
  p_hidden boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not (select private.is_member_admin()) then
    raise exception 'Accès administrateur requis';
  end if;
  update public.tribunal_responses
  set is_hidden = p_hidden,
      hidden_at = case when p_hidden then now() else null end,
      hidden_by = case when p_hidden then caller_id else null end
  where id = p_response_id;
  if not found then raise exception 'Réponse introuvable'; end if;
  return p_hidden;
end;
$$;

revoke all on function public.get_tribunal_context(bigint) from public, anon;
revoke all on function public.save_my_tribunal_response(bigint, bigint, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.get_tribunal_results(bigint) from public, anon;
revoke all on function public.admin_create_tribunal_session(text, timestamptz) from public, anon;
revoke all on function public.admin_set_tribunal_session_status(bigint, text) from public, anon;
revoke all on function public.admin_set_tribunal_question_active(bigint, boolean) from public, anon;
revoke all on function public.admin_set_tribunal_response_hidden(bigint, boolean) from public, anon;

grant execute on function public.get_tribunal_context(bigint) to authenticated;
grant execute on function public.save_my_tribunal_response(bigint, bigint, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.get_tribunal_results(bigint) to authenticated;
grant execute on function public.admin_create_tribunal_session(text, timestamptz) to authenticated;
grant execute on function public.admin_set_tribunal_session_status(bigint, text) to authenticated;
grant execute on function public.admin_set_tribunal_question_active(bigint, boolean) to authenticated;
grant execute on function public.admin_set_tribunal_response_hidden(bigint, boolean) to authenticated;
