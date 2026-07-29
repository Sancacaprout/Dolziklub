-- One permanent joker per member and Tribunal edition.
alter table public.tribunal_responses
  add column if not exists is_joker boolean not null default false;

alter table public.tribunal_responses
  drop constraint if exists tribunal_responses_joker_shape_check;
alter table public.tribunal_responses
  add constraint tribunal_responses_joker_shape_check check (
    not is_joker
    or (
      target_participant_id is null
      and target_album_id is null
      and target_review_id is null
      and free_text is null
      and is_hidden
      and hidden_at is not null
      and hidden_by = respondent_participant_id
    )
  );

create unique index if not exists tribunal_responses_one_joker_per_member_session_idx
  on public.tribunal_responses (session_id, respondent_participant_id)
  where is_joker;

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
  new.is_joker := coalesce(new.is_joker, false);

  if tg_op = 'UPDATE' and old.is_joker and not new.is_joker then
    raise exception 'Le joker utilisé pour cette édition est définitif';
  end if;

  if new.is_joker then
    if new.target_participant_id is not null
       or new.target_album_id is not null
       or new.target_review_id is not null
       or new.free_text is not null then
      raise exception 'Un joker ne peut contenir aucune réponse';
    end if;
    new.is_hidden := true;
    new.hidden_at := now();
    new.hidden_by := caller_id;
    return new;
  end if;

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

drop trigger if exists validate_tribunal_response on public.tribunal_responses;
create trigger validate_tribunal_response
  before insert or update of session_id, question_id, respondent_participant_id,
    target_participant_id, target_album_id, target_review_id, free_text, is_joker
  on public.tribunal_responses
  for each row execute function private.validate_tribunal_response();

create or replace function public.use_my_tribunal_joker(
  p_session_id bigint,
  p_question_id bigint
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
  if caller_id is null or not exists (
    select 1 from public.member_profiles where id = caller_id
  ) then
    raise exception 'Authentification membre requise';
  end if;
  if exists (
    select 1
    from public.tribunal_responses response
    where response.session_id = p_session_id
      and response.respondent_participant_id = caller_id
      and response.is_joker
  ) then
    raise exception 'Ton joker a déjà été utilisé pour cette édition';
  end if;
  if exists (
    select 1
    from public.tribunal_responses response
    where response.session_id = p_session_id
      and response.question_id = p_question_id
      and response.respondent_participant_id = caller_id
  ) then
    raise exception 'Cette question possède déjà une réponse';
  end if;

  insert into public.tribunal_responses (
    session_id,
    question_id,
    respondent_participant_id,
    is_joker
  )
  values (
    p_session_id,
    p_question_id,
    caller_id,
    true
  )
  returning * into saved_response;

  return jsonb_build_object(
    'id', saved_response.id,
    'targetParticipantId', null,
    'targetAlbumId', null,
    'targetReviewId', null,
    'freeText', null,
    'isJoker', true
  );
exception
  when unique_violation then
    raise exception 'Ton joker a déjà été utilisé pour cette édition';
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
  if exists (
    select 1 from public.tribunal_responses
    where id = p_response_id and is_joker
  ) then
    raise exception 'Un joker ne peut pas être modéré';
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

revoke all on function public.use_my_tribunal_joker(bigint, bigint) from public, anon, authenticated;
grant execute on function public.use_my_tribunal_joker(bigint, bigint) to authenticated;
