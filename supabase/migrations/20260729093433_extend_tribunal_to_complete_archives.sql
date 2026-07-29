-- Make every historical draw album and review selectable, persistable and
-- renderable with its canonical cover in Le Tribunal.

create table private.tribunal_archive_albums (
  id text primary key references public.archived_album_reviews(album_id) on delete restrict,
  archive_number integer not null unique check (archive_number > 0),
  draw_number integer not null check (draw_number > 0),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  artist text not null check (char_length(btrim(artist)) between 1 and 300),
  proposed_by_name text,
  listened_by_name text,
  cover_source_url text not null check (cover_source_url like '/covers/%')
);

create index tribunal_archive_albums_draw_position_idx
  on private.tribunal_archive_albums (draw_number desc, archive_number);

revoke all on table private.tribunal_archive_albums from public, anon, authenticated;

insert into private.tribunal_archive_albums (
  id, archive_number, draw_number, title, artist, proposed_by_name,
  listened_by_name, cover_source_url
)
values
  ('archive-1', 1, 1, 'Bunka', 'EVE', 'Yuna', 'kougna', '/covers/Bunka - EVE.png'),
  ('archive-2', 2, 1, 'L’école du micro d’argent', 'IAM', 'Pep', 'Enzo', '/covers/L''École du micro d''argent - IAM.png'),
  ('archive-3', 3, 1, 'The Love Album', 'P. Diddy', 'kougna', 'Motem', '/covers/The Love Album - P. Diddy.png'),
  ('archive-4', 4, 1, 'Gracias Compay', 'Compay segundo', 'Motem', 'Dod', '/covers/Gracias Compay - Compay Segundo.png'),
  ('archive-5', 5, 1, 'Submarine', 'The marias', 'Enzo', 'Pep', '/covers/Submarine - The Marías.png'),
  ('archive-6', 6, 1, 'Born to die', 'Lana del Rey', 'Dod', 'Yuna', '/covers/Born to Die - Lana Del Rey.png'),
  ('archive-7', 7, 1, 'JOŸA', 'Tayc', 'Toma', 'Chacha', '/covers/JOŸA - Tayc.png'),
  ('archive-8', 8, 1, 'The Passionate Ones', 'Nourished by time', 'Bono', 'Yuna', '/covers/The Passionate Ones - Nourished by Time.png'),
  ('archive-9', 9, 1, 'The Magic Whip', 'Blur', 'Dod', 'Bono', '/covers/The Magic Whip - Blur.png'),
  ('archive-10', 10, 2, 'Projet blue beam', 'Freeze Corleone', 'kougna', 'Toma', '/covers/Projet Blue Beam - Freeze Corleone.png'),
  ('archive-11', 11, 2, 'Land', 'Kekra', 'Bono', 'Chacha', '/covers/Land - Kekra.png'),
  ('archive-12', 12, 2, 'THY WILL BE DONE', '$uicideboy$', 'Enzo', 'Toma', '/covers/THY WILL BE DONE - $uicideboy$.png'),
  ('archive-13', 13, 2, 'Pinkerton', 'Weezer', 'Dod', 'Pep', '/covers/Pinkerton - Weezer.png'),
  ('archive-14', 14, 2, 'Euphoria', 'Labrinth', 'Yuna', 'Bono', '/covers/Euphoria - Labrinth.png'),
  ('archive-15', 15, 2, 'Timely !!', 'Anri', 'Pep', 'Yuna', '/covers/Timely!! - Anri.png'),
  ('archive-16', 16, 2, 'Jeune Prince, Part. II', 'Rsko', 'Toma', 'Motem', '/covers/Jeune Prince, Part. II - Rsko.png'),
  ('archive-17', 17, 2, 'Le Klub des 7', 'Le klub des 7', 'Motem', 'Enzo', '/covers/Le Klub des 7 - Le Klub des 7.png'),
  ('archive-18', 18, 2, 'Unter dem Eis', 'Eisblume', 'Chacha', 'Dod', '/covers/Unter dem Eis - Eisblume.png'),
  ('archive-19', 19, 3, 'Ipséité', 'Damso', 'kougna', 'Dod', '/covers/Ipséité - Damso.png'),
  ('archive-20', 20, 3, '1.6 Live', 'TIF', 'Bono', 'Motem', '/covers/1.6 Live - TIF.png'),
  ('archive-21', 21, 3, 'Oracular Spectacular', 'MGMT', 'Motem', 'Toma', '/covers/Oracular Spectacular - MGMT.png'),
  ('archive-22', 22, 3, 'Star', '2hollis', 'Enzo', 'Dod', '/covers/Star - 2hollis.png'),
  ('archive-23', 23, 3, 'Infinity on High', 'Fall Out Boy', 'Dod', 'Enzo', '/covers/Infinity on High - Fall Out Boy.png'),
  ('archive-24', 24, 3, 'BDLM Vol.1', 'Tiakola', 'Toma', 'Bono', '/covers/BDLM Vol. 1 - Tiakola.png'),
  ('archive-25', 25, 3, 'Blonde', 'Frank Ocean', 'Pep', 'Chacha', '/covers/Blonde - Frank Ocean.png'),
  ('archive-26', 26, 3, '2005', 'South Arcade', 'Yuna', 'Pep', '/covers/2005 - South Arcade.png'),
  ('archive-27', 27, 3, 'PLAY!', 'South Arcade', 'Yuna', 'Pep', '/covers/PLAY! - South Arcade.png'),
  ('archive-28', 28, 4, 'ピッパラの樹の下で', 'nano.RIPE', 'Chacha', 'Yuna', '/covers/ピッパラの樹の下で - nano.RIPE.png'),
  ('archive-29', 29, 4, 'Phantom Island', 'King Gizzard & The Lizard Wizard', 'Dod', 'Alain', '/covers/Phantom Island - King Gizzard & The Lizard Wizard.png'),
  ('archive-30', 30, 4, 'Marcos valle', 'Marcos valle', 'Bono', 'Dod', '/covers/Marcos Valle - Marcos Valle.png'),
  ('archive-31', 31, 4, 'Tonight Josephine!', 'Tape Five', 'Alain', 'Toma', '/covers/Tonight Josephine! - Tape Five.png'),
  ('archive-32', 32, 4, 'American Idiot', 'Green Day', 'Chacha', 'Motem', '/covers/American Idiot - Green Day.png'),
  ('archive-33', 33, 4, '15th anniversary Best', 'Maiko Fujita', 'Yuna', 'Chacha', '/covers/15th Anniversary Best - Maiko Fujita.png'),
  ('archive-34', 34, 4, 'MADRA', 'NEW DAD', 'Enzo', 'Yuna', '/covers/MADRA - NewDad.png'),
  ('archive-35', 35, 4, 'The great Chinggis Khan', 'Batzorig Vaanching', 'Motem', 'Pep', '/covers/The Great Chinggis Khan - Batzorig Vaanchig.png'),
  ('archive-36', 36, 4, 'Confiance', 'Kerchak', 'Toma', 'Enzo', '/covers/Confiance - Kerchak.png'),
  ('archive-37', 37, 5, 'Black Sunday', 'Cypress Hill', 'Pep', 'Bono', '/covers/Black Sunday - Cypress Hill.png'),
  ('archive-38', 38, 5, 'All things must pass', 'George Harrison', 'Dod', 'Motem', '/covers/All Things Must Pass - George Harrison.png'),
  ('archive-39', 39, 5, 'Moon Safari', 'Air', 'Motem', 'Chacha', '/covers/Moon Safari - Air.png'),
  ('archive-40', 40, 5, 'The Low End Theory', 'A Tribe Called Quest', 'Pep', 'Toma', '/covers/The Low End Theory - A Tribe Called Quest.png'),
  ('archive-41', 41, 5, 'Best Day', 'LiSA', 'Chacha', 'Pep', '/covers/Best Day - LiSA.png'),
  ('archive-42', 42, 5, 'This is how tomorrow moves', 'beabadoobe', 'Enzo', 'Bono', '/covers/This Is How Tomorrow Moves - beabadoobee.png'),
  ('archive-43', 43, 5, 'Hey u x', 'BENEE', 'Toma', 'Yuna', '/covers/Hey u x - BENEE.png'),
  ('archive-44', 44, 5, 'ITEKOMA HITS', 'Otoboke Beaver', 'Dod', 'Enzo', '/covers/ITEKOMA HITS - Otoboke Beaver.png'),
  ('archive-45', 45, 5, 'Sweet Boy', 'Malcolm Todd', 'Yuna', 'Dod', '/covers/Sweet Boy - Malcolm Todd.png'),
  ('archive-46', 46, 6, 'Yeezus', 'Kanye West', 'Dod', 'Toma', '/covers/Yeezus - Kanye West.png'),
  ('archive-47', 47, 6, 'Pleins Phares, pt. 2', 'Favé', 'Toma', 'Pep', '/covers/Pleins Phares, pt. 2 - Favé.png'),
  ('archive-48', 48, 6, '6 Feet Beneath the Moon', 'King Krule', 'Motem', 'Yuna', '/covers/6 Feet Beneath the Moon - King Krule.png'),
  ('archive-49', 49, 6, 'FANTASYLAND', 'Mr.Fantasy', 'Pep', 'Dod', '/covers/FANTASYLAND - Mr. Fantasy.png')
on conflict (id) do update
set archive_number = excluded.archive_number,
    draw_number = excluded.draw_number,
    title = excluded.title,
    artist = excluded.artist,
    proposed_by_name = excluded.proposed_by_name,
    listened_by_name = excluded.listened_by_name,
    cover_source_url = excluded.cover_source_url;

alter table public.tribunal_responses
  add column target_archive_album_id text
    references public.archived_album_reviews(album_id) on delete restrict,
  add column target_archive_review_id text
    references public.archived_album_reviews(album_id) on delete restrict;

create index tribunal_responses_question_target_archive_album_idx
  on public.tribunal_responses (
    session_id, question_id, target_archive_album_id
  )
  where target_archive_album_id is not null and not is_hidden;

create index tribunal_responses_question_target_archive_review_idx
  on public.tribunal_responses (
    session_id, question_id, target_archive_review_id
  )
  where target_archive_review_id is not null and not is_hidden;

alter table public.tribunal_responses
  drop constraint tribunal_responses_joker_shape_check;

alter table public.tribunal_responses
  add constraint tribunal_responses_joker_shape_check check (
    not is_joker
    or (
      target_participant_id is null
      and target_album_id is null
      and target_review_id is null
      and target_archive_album_id is null
      and target_archive_review_id is null
      and free_text is null
      and is_hidden
      and hidden_at is not null
      and hidden_by = respondent_participant_id
    )
  );

create or replace function private.tribunal_album_evidence()
returns table (
  id text,
  title text,
  artist text,
  proposed_by_name text,
  draw_number integer,
  sort_position integer,
  cover_path text,
  cover_source_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    entry.id::text,
    entry.album_title,
    entry.album_artist,
    entry.proposed_by_name,
    entry.draw_number,
    coalesce(entry.archive_number, entry.position),
    entry.cover_path,
    entry.cover_source_url
  from public.club_draw_entries entry
  join public.club_draws draw on draw.draw_number = entry.draw_number
  where draw.status in ('published', 'locked')
    and entry.album_title is not null
    and entry.album_artist is not null
    and (entry.archive_number is null or entry.archive_number > 49)

  union all

  select
    archive.id,
    archive.title,
    archive.artist,
    archive.proposed_by_name,
    archive.draw_number,
    archive.archive_number,
    override.cover_path,
    archive.cover_source_url
  from private.tribunal_archive_albums archive
  left join public.album_cover_overrides override on override.album_id = archive.id;
$$;

revoke all on function private.tribunal_album_evidence()
  from public, anon, authenticated;

create or replace function private.tribunal_review_evidence()
returns table (
  id text,
  album_id text,
  album_title text,
  artist text,
  member_id text,
  member_name text,
  rating numeric,
  review_title text,
  review_excerpt text,
  draw_number integer,
  sort_position integer,
  cover_path text,
  cover_source_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    review.id::text,
    entry.id::text,
    entry.album_title,
    entry.album_artist,
    reviewer.id::text,
    reviewer.display_name,
    review.rating,
    review.review_title,
    left(review.review, 240),
    entry.draw_number,
    coalesce(entry.archive_number, entry.position),
    entry.cover_path,
    entry.cover_source_url
  from public.member_album_reviews review
  join public.club_draw_entries entry on entry.id::text = review.album_id
  join public.club_draws draw on draw.draw_number = entry.draw_number
  join public.member_profiles reviewer on reviewer.id = review.member_id
  where draw.status in ('published', 'locked')
    and entry.album_title is not null
    and entry.album_artist is not null
    and review.review is not null
    and review.rating is not null
    and (entry.archive_number is null or entry.archive_number > 49)

  union all

  select
    'archive-review-' || archive.archive_number,
    archive.id,
    archive.title,
    archive.artist,
    coalesce(
      reviewer.id::text,
      'archive-listener:' || archived_review.listener_username
    ),
    coalesce(reviewer.display_name, archived_review.listener_username),
    archived_review.rating,
    archived_review.review_title,
    left(archived_review.review, 240),
    archive.draw_number,
    archive.archive_number,
    override.cover_path,
    archive.cover_source_url
  from private.tribunal_archive_albums archive
  join public.archived_album_reviews archived_review
    on archived_review.album_id = archive.id
  left join public.member_profiles reviewer
    on lower(reviewer.username) = lower(archived_review.listener_username)
  left join public.album_cover_overrides override
    on override.album_id = archive.id
  where archived_review.review is not null
    and archived_review.rating is not null;
$$;

revoke all on function private.tribunal_review_evidence()
  from public, anon, authenticated;
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
     or (
       question_record.closes_at is not null
       and question_record.closes_at <= now()
     ) then
    raise exception 'Cette édition du Tribunal n’accepte plus de réponse';
  end if;
  if not exists (
    select 1
    from public.tribunal_session_participants participant
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
       or new.target_archive_album_id is not null
       or new.target_archive_review_id is not null
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
       or new.target_archive_album_id is not null
       or new.target_archive_review_id is not null
       or new.free_text is not null then
      raise exception 'Choisis un autre membre pour cette question';
    end if;
  elsif question_record.type = 'member_text' then
    text_limit := least(
      160,
      greatest(
        1,
        coalesce((question_record.config ->> 'maxLength')::integer, 160)
      )
    );
    if new.target_participant_id is null
       or new.target_participant_id = caller_id
       or new.target_album_id is not null
       or new.target_review_id is not null
       or new.target_archive_album_id is not null
       or new.target_archive_review_id is not null
       or new.free_text is null
       or char_length(new.free_text) > text_limit then
      raise exception 'Choisis un autre membre et respecte la limite du texte';
    end if;
  elsif question_record.type = 'album' then
    if new.target_participant_id is not null
       or new.target_review_id is not null
       or new.target_archive_review_id is not null
       or new.free_text is not null
       or (
         new.target_album_id is null
         and new.target_archive_album_id is null
       )
       or (
         new.target_album_id is not null
         and new.target_archive_album_id is not null
       )
       or (
         new.target_album_id is not null
         and not exists (
           select 1
           from private.tribunal_album_evidence() evidence
           where evidence.id = new.target_album_id::text
         )
       )
       or (
         new.target_archive_album_id is not null
         and not exists (
           select 1
           from private.tribunal_album_evidence() evidence
           where evidence.id = new.target_archive_album_id
         )
       ) then
      raise exception 'Choisis un album réellement proposé dans le club';
    end if;
  elsif question_record.type = 'review' then
    if new.target_participant_id is not null
       or new.target_album_id is not null
       or new.target_archive_album_id is not null
       or new.free_text is not null
       or (
         new.target_review_id is null
         and new.target_archive_review_id is null
       )
       or (
         new.target_review_id is not null
         and new.target_archive_review_id is not null
       )
       or (
         new.target_review_id is not null
         and not exists (
           select 1
           from private.tribunal_review_evidence() evidence
           where evidence.id = new.target_review_id::text
         )
       )
       or (
         new.target_archive_review_id is not null
         and not exists (
           select 1
           from private.tribunal_review_evidence() evidence
           where evidence.id = 'archive-review-' ||
             replace(new.target_archive_review_id, 'archive-', '')
         )
       ) then
      raise exception 'Choisis une note réelle du tableur';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_tribunal_response()
  from public, anon, authenticated;

drop trigger if exists validate_tribunal_response
  on public.tribunal_responses;

create trigger validate_tribunal_response
  before insert or update of session_id, question_id, respondent_participant_id,
    target_participant_id, target_album_id, target_review_id,
    target_archive_album_id, target_archive_review_id, free_text, is_joker
  on public.tribunal_responses
  for each row execute function private.validate_tribunal_response();

create function public.get_tribunal_context_v2(
  p_session_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  selected_session_id bigint;
  payload jsonb;
begin
  payload := public.get_tribunal_context(p_session_id);
  selected_session_id := nullif(payload #>> '{session,id}', '')::bigint;

  if selected_session_id is null then
    return payload;
  end if;

  payload := jsonb_set(
    payload,
    '{albums}',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', evidence.id,
          'title', evidence.title,
          'artist', evidence.artist,
          'proposedBy', evidence.proposed_by_name,
          'drawNumber', evidence.draw_number,
          'coverPath', evidence.cover_path,
          'coverSourceUrl', evidence.cover_source_url
        )
        order by evidence.draw_number desc, evidence.sort_position
      )
      from private.tribunal_album_evidence() evidence
    ), '[]'::jsonb)
  );

  payload := jsonb_set(
    payload,
    '{reviews}',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', evidence.id,
          'albumId', evidence.album_id,
          'albumTitle', evidence.album_title,
          'artist', evidence.artist,
          'memberId', evidence.member_id,
          'memberName', evidence.member_name,
          'rating', evidence.rating,
          'reviewTitle', evidence.review_title,
          'reviewExcerpt', evidence.review_excerpt,
          'drawNumber', evidence.draw_number,
          'coverPath', evidence.cover_path,
          'coverSourceUrl', evidence.cover_source_url
        )
        order by evidence.draw_number desc, evidence.sort_position
      )
      from private.tribunal_review_evidence() evidence
    ), '[]'::jsonb)
  );

  payload := jsonb_set(
    payload,
    '{questions}',
    coalesce((
      select jsonb_agg(
        case
          when response.id is null then question.item
          else jsonb_set(
            jsonb_set(
              jsonb_set(
                question.item,
                '{answer,targetAlbumId}',
                coalesce(
                  to_jsonb(
                    coalesce(
                      response.target_album_id::text,
                      response.target_archive_album_id
                    )
                  ),
                  'null'::jsonb
                )
              ),
              '{answer,targetReviewId}',
              coalesce(
                to_jsonb(
                  coalesce(
                    response.target_review_id::text,
                    case
                      when response.target_archive_review_id is null then null
                      else 'archive-review-' || replace(
                        response.target_archive_review_id,
                        'archive-',
                        ''
                      )
                    end
                  )
                ),
                'null'::jsonb
              )
            ),
            '{answer,isJoker}',
            to_jsonb(response.is_joker)
          )
        end
        order by (question.item ->> 'position')::integer
      )
      from jsonb_array_elements(payload -> 'questions')
        with ordinality as question(item, ordinal)
      left join public.tribunal_responses response
        on response.session_id = selected_session_id
       and response.question_id = (question.item ->> 'id')::bigint
       and response.respondent_participant_id = caller_id
    ), '[]'::jsonb)
  );

  return payload;
end;
$$;

revoke all on function public.get_tribunal_context_v2(bigint)
  from public, anon, authenticated;
grant execute on function public.get_tribunal_context_v2(bigint)
  to authenticated;

create function public.save_my_tribunal_response_v2(
  p_session_id bigint,
  p_question_id bigint,
  p_target_participant_id uuid default null,
  p_target_album_id text default null,
  p_target_review_id text default null,
  p_free_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  live_album_id uuid;
  archive_album_id text;
  live_review_id uuid;
  archive_review_id text;
  saved_response public.tribunal_responses%rowtype;
begin
  if caller_id is null or not exists (
    select 1 from public.member_profiles where id = caller_id
  ) then
    raise exception 'Authentification membre requise';
  end if;

  if p_target_album_id is not null then
    if p_target_album_id ~ '^archive-[0-9]+$' then
      archive_album_id := p_target_album_id;
    else
      live_album_id := p_target_album_id::uuid;
    end if;
  end if;

  if p_target_review_id is not null then
    if p_target_review_id ~ '^archive-review-[0-9]+$' then
      archive_review_id := replace(
        p_target_review_id,
        'archive-review-',
        'archive-'
      );
    else
      live_review_id := p_target_review_id::uuid;
    end if;
  end if;

  insert into public.tribunal_responses (
    session_id,
    question_id,
    respondent_participant_id,
    target_participant_id,
    target_album_id,
    target_review_id,
    target_archive_album_id,
    target_archive_review_id,
    free_text
  ) values (
    p_session_id,
    p_question_id,
    caller_id,
    p_target_participant_id,
    live_album_id,
    live_review_id,
    archive_album_id,
    archive_review_id,
    p_free_text
  )
  on conflict (
    session_id,
    question_id,
    respondent_participant_id
  ) do update
  set target_participant_id = excluded.target_participant_id,
      target_album_id = excluded.target_album_id,
      target_review_id = excluded.target_review_id,
      target_archive_album_id = excluded.target_archive_album_id,
      target_archive_review_id = excluded.target_archive_review_id,
      free_text = excluded.free_text,
      is_joker = false
  returning * into saved_response;

  return jsonb_build_object(
    'id', saved_response.id,
    'targetParticipantId', saved_response.target_participant_id,
    'targetAlbumId', coalesce(
      saved_response.target_album_id::text,
      saved_response.target_archive_album_id
    ),
    'targetReviewId', coalesce(
      saved_response.target_review_id::text,
      case
        when saved_response.target_archive_review_id is null then null
        else 'archive-review-' || replace(
          saved_response.target_archive_review_id,
          'archive-',
          ''
        )
      end
    ),
    'freeText', saved_response.free_text,
    'isJoker', saved_response.is_joker,
    'updatedAt', saved_response.updated_at
  );
end;
$$;

revoke all on function public.save_my_tribunal_response_v2(
  bigint, bigint, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.save_my_tribunal_response_v2(
  bigint, bigint, uuid, text, text, text
) to authenticated;
create function public.get_tribunal_results_v2(
  p_session_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
  selected_session_id bigint;
  question_item jsonb;
  question_type text;
  question_id bigint;
  total_votes integer;
  ranking jsonb;
  question_results jsonb := '[]'::jsonb;
begin
  payload := public.get_tribunal_results(p_session_id);
  selected_session_id := nullif(payload #>> '{session,id}', '')::bigint;

  for question_item in
    select item
    from jsonb_array_elements(payload -> 'questions') as question(item)
  loop
    question_type := question_item ->> 'type';
    question_id := (question_item ->> 'id')::bigint;
    total_votes := (question_item ->> 'totalVotes')::integer;

    if question_type = 'album' then
      select coalesce(
        jsonb_agg(item order by votes desc, label),
        '[]'::jsonb
      )
      into ranking
      from (
        select
          evidence.title as label,
          count(*)::integer as votes,
          jsonb_build_object(
            'kind', 'album',
            'id', evidence.id,
            'label', evidence.title,
            'artist', evidence.artist,
            'proposedBy', evidence.proposed_by_name,
            'drawNumber', evidence.draw_number,
            'votes', count(*),
            'percentage', coalesce(
              round(count(*) * 100.0 / nullif(total_votes, 0), 1),
              0
            )
          ) as item
        from public.tribunal_responses response
        join private.tribunal_album_evidence() evidence
          on evidence.id = coalesce(
            response.target_album_id::text,
            response.target_archive_album_id
          )
        where response.session_id = selected_session_id
          and response.question_id = question_id
          and not response.is_hidden
        group by
          evidence.id,
          evidence.title,
          evidence.artist,
          evidence.proposed_by_name,
          evidence.draw_number
        order by votes desc, label
        limit 3
      ) ranked;

      question_item := jsonb_set(question_item, '{ranking}', ranking);
    elsif question_type = 'review' then
      select coalesce(
        jsonb_agg(item order by votes desc, label),
        '[]'::jsonb
      )
      into ranking
      from (
        select
          evidence.album_title as label,
          count(*)::integer as votes,
          jsonb_build_object(
            'kind', 'review',
            'id', evidence.id,
            'label', evidence.album_title,
            'artist', evidence.artist,
            'memberName', evidence.member_name,
            'rating', evidence.rating,
            'reviewTitle', evidence.review_title,
            'reviewExcerpt', evidence.review_excerpt,
            'drawNumber', evidence.draw_number,
            'votes', count(*),
            'percentage', coalesce(
              round(count(*) * 100.0 / nullif(total_votes, 0), 1),
              0
            )
          ) as item
        from public.tribunal_responses response
        join private.tribunal_review_evidence() evidence
          on evidence.id = coalesce(
            response.target_review_id::text,
            case
              when response.target_archive_review_id is null then null
              else 'archive-review-' || replace(
                response.target_archive_review_id,
                'archive-',
                ''
              )
            end
          )
        where response.session_id = selected_session_id
          and response.question_id = question_id
          and not response.is_hidden
        group by
          evidence.id,
          evidence.album_title,
          evidence.artist,
          evidence.member_name,
          evidence.rating,
          evidence.review_title,
          evidence.review_excerpt,
          evidence.draw_number
        order by votes desc, label
        limit 3
      ) ranked;

      question_item := jsonb_set(question_item, '{ranking}', ranking);
    end if;

    question_results := question_results || jsonb_build_array(question_item);
  end loop;

  return jsonb_set(payload, '{questions}', question_results);
end;
$$;

revoke all on function public.get_tribunal_results_v2(bigint)
  from public, anon, authenticated;
grant execute on function public.get_tribunal_results_v2(bigint)
  to authenticated;