-- A global draw is one shared proposal, but every participant (including the
-- proposer) owns one listener row and may therefore publish one verdict.
begin;

alter table public.club_draw_entries
  drop constraint if exists club_draw_entries_no_self_assignment;

create or replace function private.validate_club_draw_entry_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  draw_record record;
  global_proposer_id uuid;
begin
  select draw.draw_type, draw.participant_usernames, draw.global_proposer_username
    into draw_record
  from public.club_draws as draw
  where draw.draw_number = new.draw_number;

  if not found then
    raise exception 'Unknown draw';
  end if;

  if new.proposed_by is not null and not exists (
    select 1 from public.member_profiles as profile
    where profile.id = new.proposed_by
      and lower(profile.username) = any(draw_record.participant_usernames)
  ) then
    raise exception 'The proposer must belong to this draw';
  end if;

  if new.listened_by is not null and not exists (
    select 1 from public.member_profiles as profile
    where profile.id = new.listened_by
      and lower(profile.username) = any(draw_record.participant_usernames)
  ) then
    raise exception 'The listener must belong to this draw';
  end if;

  if new.listened_by is not null and exists (
    select 1 from public.club_draw_entries as existing
    where existing.draw_number = new.draw_number
      and existing.listened_by = new.listened_by
      and existing.id <> new.id
  ) then
    raise exception 'A listener can only appear once in a newly assigned draw';
  end if;
  if draw_record.draw_type = 'standard'
    and new.proposed_by is not null
    and new.listened_by is not null
    and new.proposed_by = new.listened_by then
    raise exception 'A member cannot propose and listen to the same album in a classic draw';
  end if;

  if draw_record.draw_type = 'global' and new.proposed_by is not null then
    select profile.id into global_proposer_id
    from public.member_profiles as profile
    where lower(profile.username) = lower(draw_record.global_proposer_username);

    if global_proposer_id is null or new.proposed_by <> global_proposer_id then
      raise exception 'The global proposer cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_club_draw_entry_assignment() from public, anon, authenticated;
drop trigger if exists club_draw_entries_validate_assignment on public.club_draw_entries;
create trigger club_draw_entries_validate_assignment
  before insert or update of draw_number, proposed_by, listened_by
  on public.club_draw_entries
  for each row execute function private.validate_club_draw_entry_assignment();
create function public.admin_create_club_draw(
  p_participant_usernames text[],
  p_avoid_repeated_pairs boolean default true,
  p_draw_type text default 'standard',
  p_global_proposer_username text default null,
  p_legacy_forbidden_pairs text[] default '{}'::text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_usernames text[];
  normalized_legacy_pairs text[];
  normalized_type text := lower(coalesce(nullif(btrim(p_draw_type), ''), 'standard'));
  normalized_global_proposer text := lower(nullif(btrim(p_global_proposer_username), ''));
  next_draw integer;
  global_proposer public.member_profiles%rowtype;
  proposer_ids uuid[];
  listener_ids uuid[];
  assignment_found boolean := false;
  attempt integer;
begin
  perform private.require_draw_admin();

  select array_agg(distinct lower(btrim(username)) order by lower(btrim(username)))
    into normalized_usernames
  from unnest(p_participant_usernames) as username
  where nullif(btrim(username), '') is not null;

  select coalesce(array_agg(distinct lower(btrim(pair))), '{}'::text[])
    into normalized_legacy_pairs
  from unnest(coalesce(p_legacy_forbidden_pairs, '{}'::text[])) as pair
  where nullif(btrim(pair), '') is not null;

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
    where lower(listener.username) = any(normalized_usernames);
  else
    for attempt in 1..5000 loop
      select array_agg(profile.id order by random())
        into proposer_ids
      from public.member_profiles as profile
      where lower(profile.username) = any(normalized_usernames);

      select array_agg(profile.id order by random())
        into listener_ids
      from public.member_profiles as profile
      where lower(profile.username) = any(normalized_usernames);

      select not exists (
        select 1
        from generate_subscripts(proposer_ids, 1) as slot(position)
        join public.member_profiles as proposer on proposer.id = proposer_ids[slot.position]
        join public.member_profiles as listener on listener.id = listener_ids[slot.position]
        where proposer.id = listener.id
          or (
            coalesce(p_avoid_repeated_pairs, true)
            and (
              lower(proposer.username) || '|' || lower(listener.username) = any(normalized_legacy_pairs)
              or exists (
                select 1
                from public.club_draw_entries as earlier_entry
                join public.club_draws as earlier_draw on earlier_draw.draw_number = earlier_entry.draw_number
                where earlier_draw.status in ('published', 'locked')
                  and earlier_entry.proposed_by = proposer.id
                  and earlier_entry.listened_by = listener.id
              )
            )
          )
      ) into assignment_found;

      exit when assignment_found;
    end loop;

    if not assignment_found then
      raise exception 'Impossible to generate a classic draw with the selected participants and their pairing history';
    end if;

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
      slot.position,
      proposer.id,
      listener.id,
      proposer.username,
      listener.username
    from generate_subscripts(proposer_ids, 1) as slot(position)
    join public.member_profiles as proposer on proposer.id = proposer_ids[slot.position]
    join public.member_profiles as listener on listener.id = listener_ids[slot.position]
    order by slot.position;
  end if;

  return next_draw;
end;
$$;
revoke all on function public.admin_create_club_draw(text[], boolean, text, text, text[]) from public, anon;
grant execute on function public.admin_create_club_draw(text[], boolean, text, text, text[]) to authenticated;
create or replace function public.admin_update_club_draw_entry(
  p_entry_id uuid,
  p_proposer_username text,
  p_listener_username text,
  p_confirm_reset boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
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
  if draw.draw_type <> 'global' and proposer.id is not null and listener.id is not null and proposer.id = listener.id then
    raise exception 'A member cannot propose and listen to the same album in a classic draw';
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
set search_path = ''
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
    if row_count <> cardinality(draw.participant_usernames)
      or proposer_count <> 1
      or listener_count <> row_count
      or self_assignment_count <> 1
      or wrong_global_proposer_count > 0 then
      raise exception 'A global draw needs one proposer and one unique review row for every participant, including the proposer';
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
revoke all on function public.admin_update_club_draw_entry(uuid, text, text, boolean) from public, anon;
revoke all on function public.admin_publish_club_draw(integer) from public, anon;
grant execute on function public.admin_update_club_draw_entry(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_publish_club_draw(integer) to authenticated;

-- Backfill the missing listener row on pre-existing global draws. Copying the
-- common album metadata makes the review form available immediately, while a
-- NOT EXISTS guard keeps this safe to replay.
insert into public.club_draw_entries (
  draw_number, position, proposed_by, listened_by, proposed_by_name, listened_by_name,
  album_title, album_artist, cover_path, youtube_playlist_id, youtube_video_id,
  youtube_music_url, youtube_url, cover_source_url, youtube_published_at,
  music_channel_title, music_resource_type, music_match_confidence,
  music_metadata_source, music_metadata_verified, music_metadata_locked,
  assigned_at, historical_source, source_archive_album_id
)
select
  draw.draw_number,
  coalesce((select max(existing.position) + 1 from public.club_draw_entries as existing where existing.draw_number = draw.draw_number), 1),
  proposer.id,
  proposer.id,
  proposer.username,
  proposer.username,
  template.album_title,
  template.album_artist,
  template.cover_path,
  template.youtube_playlist_id,
  template.youtube_video_id,
  template.youtube_music_url,
  template.youtube_url,
  template.cover_source_url,
  template.youtube_published_at,
  template.music_channel_title,
  template.music_resource_type,
  template.music_match_confidence,
  template.music_metadata_source,
  template.music_metadata_verified,
  template.music_metadata_locked,
  template.assigned_at,
  template.historical_source,
  template.source_archive_album_id
from public.club_draws as draw
join public.member_profiles as proposer
  on lower(proposer.username) = lower(draw.global_proposer_username)
left join lateral (
  select entry.*
  from public.club_draw_entries as entry
  where entry.draw_number = draw.draw_number
  order by entry.position
  limit 1
) as template on true
where draw.draw_type = 'global'
  and lower(proposer.username) = any(draw.participant_usernames)
  and not exists (
    select 1 from public.club_draw_entries as existing
    where existing.draw_number = draw.draw_number
      and existing.listened_by = proposer.id
  );


-- Yuna's Kendrick Lamar selection had a spelling error in the title. Only the
-- affected best_track field is changed; the review, note and every other field
-- remain untouched. Each predicate already excludes the corrected value.
update public.member_album_reviews as review
set best_track = 'Wesley''s Theory'
from public.member_profiles as profile, public.club_draw_entries as entry
where review.member_id = profile.id
  and review.album_id = entry.id::text
  and lower(profile.username) = 'yuna'
  and btrim(regexp_replace(lower(entry.album_artist), '[^a-z0-9]+', ' ', 'g')) = 'kendrick lamar'
  and btrim(regexp_replace(lower(review.best_track), '[^a-z0-9]+', ' ', 'g')) in ('weasley s theory', 'weasleys theory');

update public.album_track_selections as selection
set title = 'Wesley''s Theory', updated_at = now()
from public.member_album_reviews as review
join public.member_profiles as profile on profile.id = review.member_id
join public.club_draw_entries as entry on entry.id::text = review.album_id
where selection.review_id = review.id
  and selection.selection_type = 'best'
  and lower(profile.username) = 'yuna'
  and btrim(regexp_replace(lower(entry.album_artist), '[^a-z0-9]+', ' ', 'g')) = 'kendrick lamar'
  and btrim(regexp_replace(lower(selection.title), '[^a-z0-9]+', ' ', 'g')) in ('weasley s theory', 'weasleys theory');

update public.archived_album_reviews as review
set best_track = 'Wesley''s Theory', updated_at = now(), is_modified = true
from public.club_draw_entries as entry
where review.draw_entry_id = entry.id
  and lower(review.listener_username) = 'yuna'
  and btrim(regexp_replace(lower(entry.album_artist), '[^a-z0-9]+', ' ', 'g')) = 'kendrick lamar'
  and btrim(regexp_replace(lower(review.best_track), '[^a-z0-9]+', ' ', 'g')) in ('weasley s theory', 'weasleys theory');

commit;