-- Add a global draw mode: one proposer selects one album, every other
-- participant receives an individual review row for that same album.
alter table public.club_draws
  add column if not exists draw_type text not null default 'standard',
  add column if not exists global_proposer_username text;

alter table public.club_draws
  drop constraint if exists club_draws_draw_type_check,
  drop constraint if exists club_draws_global_proposer_check;

alter table public.club_draws
  add constraint club_draws_draw_type_check
    check (draw_type in ('standard', 'global')),
  add constraint club_draws_global_proposer_check
    check (
      (draw_type = 'standard' and global_proposer_username is null)
      or
      (
        draw_type = 'global'
        and global_proposer_username is not null
        and lower(global_proposer_username) = any(participant_usernames)
      )
    );

drop function if exists public.admin_create_club_draw(text[], boolean);
create function public.admin_create_club_draw(
  p_participant_usernames text[],
  p_avoid_repeated_pairs boolean default true,
  p_draw_type text default 'standard',
  p_global_proposer_username text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_usernames text[];
  normalized_type text := lower(coalesce(nullif(btrim(p_draw_type), ''), 'standard'));
  normalized_global_proposer text := lower(nullif(btrim(p_global_proposer_username), ''));
  next_draw integer;
  global_proposer public.member_profiles%rowtype;
begin
  perform private.require_draw_admin();

  select array_agg(distinct lower(btrim(username)) order by lower(btrim(username)))
    into normalized_usernames
  from unnest(p_participant_usernames) as username
  where nullif(btrim(username), '') is not null;

  if cardinality(normalized_usernames) < 2 then
    raise exception 'At least two participants are required';
  end if;
  if cardinality(normalized_usernames) <> cardinality(p_participant_usernames) then
    raise exception 'Each participant must be selected only once';
  end if;
  if (select count(*) from public.member_profiles where lower(username) = any(normalized_usernames)) <> cardinality(normalized_usernames) then
    raise exception 'Unknown participant';
  end if;
  if normalized_type not in ('standard', 'global') then
    raise exception 'Unknown draw type';
  end if;

  if normalized_type = 'global' then
    if normalized_global_proposer is null or not (normalized_global_proposer = any(normalized_usernames)) then
      raise exception 'A global proposer must be selected among the participants';
    end if;
    select * into global_proposer
    from public.member_profiles
    where lower(username) = normalized_global_proposer;
    if global_proposer.id is null then
      raise exception 'Unknown global proposer';
    end if;
  else
    normalized_global_proposer := null;
  end if;

  select greatest(coalesce(max(draw_number), 0), 6) + 1
    into next_draw
  from public.club_draws;

  insert into public.club_draws (
    draw_number,
    participant_usernames,
    status,
    avoid_repeated_pairs,
    draw_type,
    global_proposer_username
  )
  values (
    next_draw,
    normalized_usernames,
    'draft',
    case when normalized_type = 'global' then false else coalesce(p_avoid_repeated_pairs, true) end,
    normalized_type,
    normalized_global_proposer
  );

  if normalized_type = 'global' then
    insert into public.club_draw_entries (
      draw_number,
      position,
      proposed_by,
      listened_by,
      proposed_by_name,
      listened_by_name
    )
    select
      next_draw,
      row_number() over (order by lower(listener.username))::integer,
      global_proposer.id,
      listener.id,
      global_proposer.username,
      listener.username
    from public.member_profiles as listener
    where lower(listener.username) = any(normalized_usernames)
      and listener.id <> global_proposer.id;
  else
    insert into public.club_draw_entries (draw_number, position)
    select next_draw, series
    from generate_series(1, cardinality(normalized_usernames)) as series;
  end if;

  return next_draw;
end;
$$;

create or replace function public.admin_update_club_draw_entry(
  p_entry_id uuid,
  p_proposer_username text,
  p_listener_username text,
  p_confirm_reset boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entry public.club_draw_entries%rowtype;
  draw public.club_draws%rowtype;
  proposer public.member_profiles%rowtype;
  listener public.member_profiles%rowtype;
  has_content boolean;
  assignment_changed boolean;
begin
  perform private.require_draw_admin();

  select * into entry from public.club_draw_entries where id = p_entry_id;
  if not found then raise exception 'Unknown draw slot'; end if;
  select * into draw from public.club_draws where draw_number = entry.draw_number;
  if not found or draw.status = 'locked' then raise exception 'This draw is locked'; end if;

  if nullif(btrim(p_proposer_username), '') is not null then
    select * into proposer from public.member_profiles where lower(username) = lower(btrim(p_proposer_username));
    if proposer.id is null or not (lower(proposer.username) = any(draw.participant_usernames)) then raise exception 'Invalid proposer'; end if;
  end if;
  if nullif(btrim(p_listener_username), '') is not null then
    select * into listener from public.member_profiles where lower(username) = lower(btrim(p_listener_username));
    if listener.id is null or not (lower(listener.username) = any(draw.participant_usernames)) then raise exception 'Invalid listener'; end if;
  end if;
  if proposer.id is not null and listener.id is not null and proposer.id = listener.id then
    raise exception 'A member cannot propose and listen to the same album';
  end if;

  if draw.draw_type = 'global' then
    if proposer.id is null or lower(proposer.username) <> lower(draw.global_proposer_username) then
      raise exception 'The global proposer cannot be changed';
    end if;
    if listener.id is null or exists (
      select 1 from public.club_draw_entries
      where draw_number = entry.draw_number and id <> entry.id and listened_by = listener.id
    ) then
      raise exception 'Each global listener can only appear once';
    end if;
  else
    if proposer.id is not null and exists (
      select 1 from public.club_draw_entries
      where draw_number = entry.draw_number and id <> entry.id and proposed_by = proposer.id
    ) then raise exception 'A proposer can only appear once per draw'; end if;
    if listener.id is not null and exists (
      select 1 from public.club_draw_entries
      where draw_number = entry.draw_number and id <> entry.id and listened_by = listener.id
    ) then raise exception 'A listener can only appear once per draw'; end if;
    if draw.avoid_repeated_pairs and proposer.id is not null and listener.id is not null and exists (
      select 1
      from public.club_draw_entries as earlier_entry
      join public.club_draws as earlier_draw on earlier_draw.draw_number = earlier_entry.draw_number
      where earlier_entry.draw_number <> entry.draw_number
        and earlier_draw.status in ('published', 'locked')
        and earlier_entry.proposed_by = proposer.id
        and earlier_entry.listened_by = listener.id
    ) then
      raise exception 'This proposer/listener duo already appeared in an earlier draw';
    end if;
  end if;

  assignment_changed := entry.proposed_by is distinct from proposer.id or entry.listened_by is distinct from listener.id;
  has_content := entry.album_title is not null or entry.album_artist is not null or exists (
    select 1 from public.member_album_reviews where album_id = entry.id::text
  );
  if assignment_changed and has_content and not p_confirm_reset then
    raise exception 'Confirmation required: this change will clear the album and its review';
  end if;
  if assignment_changed and has_content then
    delete from public.member_album_reviews where album_id = entry.id::text;
  end if;

  update public.club_draw_entries
     set proposed_by = proposer.id,
         listened_by = listener.id,
         proposed_by_name = proposer.username,
         listened_by_name = listener.username,
         album_title = case when assignment_changed and has_content then null else album_title end,
         album_artist = case when assignment_changed and has_content then null else album_artist end,
         cover_path = case when assignment_changed and has_content then null else cover_path end
   where id = entry.id;
end;
$$;

create or replace function public.admin_publish_club_draw(p_draw_number integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  draw public.club_draws%rowtype;
  row_count integer;
  proposer_count integer;
  listener_count integer;
  self_assignment_count integer;
  wrong_global_proposer_count integer;
begin
  perform private.require_draw_admin();
  select * into draw from public.club_draws where draw_number = p_draw_number;
  if not found or draw.status = 'locked' then raise exception 'This draw is locked'; end if;

  select
    count(*),
    count(distinct proposed_by),
    count(distinct listened_by),
    count(*) filter (where proposed_by = listened_by),
    count(*) filter (where lower(proposed_by_name) is distinct from lower(draw.global_proposer_username))
  into row_count, proposer_count, listener_count, self_assignment_count, wrong_global_proposer_count
  from public.club_draw_entries
  where draw_number = p_draw_number
    and proposed_by is not null
    and listened_by is not null;

  if draw.draw_type = 'global' then
    if row_count <> cardinality(draw.participant_usernames) - 1
      or proposer_count <> 1
      or listener_count <> row_count
      or self_assignment_count > 0
      or wrong_global_proposer_count > 0 then
      raise exception 'A global draw needs one proposer and one unique review row for every other participant';
    end if;
  elsif row_count <> cardinality(draw.participant_usernames)
    or proposer_count <> row_count
    or listener_count <> row_count
    or self_assignment_count > 0 then
    raise exception 'Every participant must appear exactly once, without listening to their own proposal, before publication';
  end if;

  update public.club_draws
     set status = 'locked', locked_at = now()
   where status = 'published' and draw_number <> p_draw_number;
  update public.club_draws
     set status = 'published', published_at = now(), locked_at = null
   where draw_number = p_draw_number;
end;
$$;

-- Keep all global review rows on exactly the same album and metadata.
create or replace function private.sync_global_draw_proposal()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  global_draw boolean;
begin
  if pg_trigger_depth() > 1 then return new; end if;
  select draw.draw_type = 'global'
    into global_draw
  from public.club_draws as draw
  where draw.draw_number = new.draw_number;
  if not coalesce(global_draw, false) then return new; end if;

  update public.club_draw_entries
     set album_title = new.album_title,
         album_artist = new.album_artist,
         cover_path = new.cover_path,
         youtube_playlist_id = new.youtube_playlist_id,
         youtube_video_id = new.youtube_video_id,
         youtube_music_url = new.youtube_music_url,
         youtube_url = new.youtube_url,
         cover_source_url = new.cover_source_url,
         youtube_published_at = new.youtube_published_at,
         music_channel_title = new.music_channel_title,
         music_resource_type = new.music_resource_type,
         music_match_confidence = new.music_match_confidence,
         music_metadata_source = new.music_metadata_source,
         music_metadata_verified = new.music_metadata_verified,
         music_metadata_locked = new.music_metadata_locked
   where draw_number = new.draw_number
     and id <> new.id;
  return new;
end;
$$;

revoke all on function private.sync_global_draw_proposal() from public, anon, authenticated;
drop trigger if exists club_draw_entries_sync_global_proposal on public.club_draw_entries;
create trigger club_draw_entries_sync_global_proposal
  after update of album_title, album_artist, cover_path, youtube_playlist_id,
    youtube_video_id, youtube_music_url, youtube_url, cover_source_url,
    youtube_published_at, music_channel_title, music_resource_type,
    music_match_confidence, music_metadata_source, music_metadata_verified,
    music_metadata_locked
  on public.club_draw_entries
  for each row execute function private.sync_global_draw_proposal();

-- Publish only one proposal task for a global draw, while listeners still
-- receive their own task when the common album is filled in.
create or replace function private.notify_draw_published()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.member_notifications (recipient_id, kind, title, body, href)
    select profile.id, 'draw', 'Nouveau tirage publié',
      case when new.draw_type = 'global'
        then 'Le tirage global #' || new.draw_number || ' est prêt : tout le club écoutera le même album.'
        else 'Le tirage #' || new.draw_number || ' est prêt : découvre ton binôme.'
      end,
      '/tableur'
    from public.member_profiles as profile;

    if new.draw_type = 'global' then
      insert into public.member_notifications (recipient_id, kind, title, body, href)
      select entry.proposed_by, 'task', 'Choisis l’album du club',
        'Le tirage global #' || new.draw_number || ' est en ligne : propose l’album commun.',
        '/tableur?proposal=' || entry.id::text
      from public.club_draw_entries as entry
      where entry.draw_number = new.draw_number
        and entry.proposed_by is not null
      order by entry.position
      limit 1;
    else
      insert into public.member_notifications (recipient_id, kind, title, body, href)
      select
        entry.proposed_by,
        'task',
        'Tu dois proposer un album',
        'Le tirage #' || new.draw_number || ' est en ligne : propose un album pour ' ||
          coalesce(
            (select coalesce(nullif(btrim(profile.display_name), ''), profile.username)
               from public.member_profiles as profile
              where profile.id = entry.listened_by),
            entry.listened_by_name,
            'ton binôme'
          ) || '.',
        '/tableur?proposal=' || entry.id::text
      from public.club_draw_entries as entry
      where entry.draw_number = new.draw_number
        and entry.proposed_by is not null
        and (entry.album_title is null or entry.album_artist is null);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.admin_create_club_draw(text[], boolean, text, text) from public, anon;
revoke all on function public.admin_update_club_draw_entry(uuid, text, text, boolean) from public, anon;
revoke all on function public.admin_publish_club_draw(integer) from public, anon;
grant execute on function public.admin_create_club_draw(text[], boolean, text, text) to authenticated;
grant execute on function public.admin_update_club_draw_entry(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_publish_club_draw(integer) to authenticated;