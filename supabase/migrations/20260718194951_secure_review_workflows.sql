-- Verdicts from current draws are persisted through listener-scoped RPCs.
-- This avoids an RLS upsert ambiguity while still authorizing only the member
-- assigned to the exact draw entry, including one individual row per global draw listener.
create or replace function public.save_my_draw_review(
  p_entry_id uuid,
  p_review_title text,
  p_review text,
  p_rating numeric,
  p_best_track text,
  p_worst_track text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_member_id uuid := (select auth.uid());
  saved_review_id uuid;
begin
  if current_member_id is null then
    raise exception 'Authentication required';
  end if;

  if p_review is null or char_length(btrim(p_review)) = 0 then
    raise exception 'A review is required';
  end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 or p_rating * 2 <> trunc(p_rating * 2) then
    raise exception 'Rating must be between 0 and 5 in half steps';
  end if;

  if not exists (
    select 1
    from public.club_draw_entries as entry
    join public.club_draws as draw on draw.draw_number = entry.draw_number
    where entry.id = p_entry_id
      and entry.listened_by = current_member_id
      and draw.status in ('published', 'locked')
      and nullif(btrim(entry.album_title), '') is not null
      and nullif(btrim(entry.album_artist), '') is not null
  ) then
    raise exception 'Only the assigned listener can review this draw entry';
  end if;

  insert into public.member_album_reviews (
    album_id, member_id, review_title, review, rating, best_track, worst_track
  )
  values (
    p_entry_id::text,
    current_member_id,
    nullif(btrim(p_review_title), ''),
    btrim(p_review),
    p_rating,
    nullif(btrim(p_best_track), ''),
    nullif(btrim(p_worst_track), '')
  )
  on conflict (album_id, member_id) do update
  set review_title = excluded.review_title,
      review = excluded.review,
      rating = excluded.rating,
      best_track = excluded.best_track,
      worst_track = excluded.worst_track
  returning id into saved_review_id;

  return saved_review_id;
end;
$$;

create or replace function public.reset_my_draw_review(p_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_member_id uuid := (select auth.uid());
  deleted_review_id uuid;
begin
  if current_member_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.club_draw_entries as entry
    join public.club_draws as draw on draw.draw_number = entry.draw_number
    where entry.id = p_entry_id
      and entry.listened_by = current_member_id
      and draw.status in ('published', 'locked')
  ) then
    raise exception 'Only the assigned listener can reset this draw review';
  end if;

  delete from public.member_album_reviews as review
  where review.album_id = p_entry_id::text
    and review.member_id = current_member_id
  returning review.id into deleted_review_id;

  if deleted_review_id is null then
    raise exception 'No review exists for this draw entry';
  end if;

  return deleted_review_id;
end;
$$;

-- Some pre-existing archive rows identify the listener with their display name
-- (for example Toma) while their account username differs (thomas). Both are
-- verified from the authenticated member profile before the row is updated.
create or replace function public.save_my_archived_album_review(
  p_album_id text,
  p_review_title text,
  p_review text,
  p_rating numeric,
  p_best_track text,
  p_worst_track text,
  p_reset boolean default false
)
returns table (
  album_id text,
  review_title text,
  review text,
  rating numeric,
  best_track text,
  worst_track text,
  is_modified boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_username text;
  current_display_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select lower(profile.username), lower(coalesce(nullif(btrim(profile.display_name), ''), profile.username))
    into current_username, current_display_name
  from public.member_profiles as profile
  where profile.id = (select auth.uid());

  if current_username is null then
    raise exception 'Member profile not found';
  end if;
  if p_album_id !~ '^archive-[0-9]+$' then
    raise exception 'Invalid archive album id';
  end if;
  if not p_reset then
    if p_review is null or char_length(btrim(p_review)) = 0 then
      raise exception 'A review is required';
    end if;
    if p_rating is null or p_rating < 0 or p_rating > 5 or p_rating * 2 <> trunc(p_rating * 2) then
      raise exception 'Rating must be between 0 and 5 in half steps';
    end if;
  end if;

  return query
  update public.archived_album_reviews as archive_review
  set review_title = case when p_reset then null else coalesce(nullif(btrim(p_review_title), ''), archive_review.review_title) end,
      review = case when p_reset then null else btrim(p_review) end,
      rating = case when p_reset then null else p_rating end,
      best_track = case when p_reset then null else nullif(btrim(p_best_track), '') end,
      worst_track = case when p_reset then null else nullif(btrim(p_worst_track), '') end,
      is_modified = true
  where archive_review.album_id = p_album_id
    and lower(archive_review.listener_username) in (current_username, current_display_name)
  returning archive_review.album_id, archive_review.review_title, archive_review.review,
    archive_review.rating, archive_review.best_track, archive_review.worst_track, archive_review.is_modified;

  if not found then
    raise exception 'Only the assigned listener can update this archived review';
  end if;
end;
$$;

revoke all on function public.save_my_draw_review(uuid, text, text, numeric, text, text) from public, anon;
revoke all on function public.reset_my_draw_review(uuid) from public, anon;
revoke all on function public.save_my_archived_album_review(text, text, text, numeric, text, text, boolean) from public, anon;
grant execute on function public.save_my_draw_review(uuid, text, text, numeric, text, text) to authenticated;
grant execute on function public.reset_my_draw_review(uuid) to authenticated;
grant execute on function public.save_my_archived_album_review(text, text, text, numeric, text, text, boolean) to authenticated;