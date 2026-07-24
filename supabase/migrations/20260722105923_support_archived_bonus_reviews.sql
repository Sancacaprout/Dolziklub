alter table public.bonus_album_reviews
  alter column entry_id drop not null,
  add column if not exists archive_album_id text;

alter table public.bonus_album_reviews
  drop constraint if exists bonus_album_reviews_entry_member_unique,
  drop constraint if exists bonus_album_reviews_exactly_one_target;

create unique index if not exists bonus_album_reviews_entry_member_unique_idx
  on public.bonus_album_reviews (entry_id, member_id)
  where entry_id is not null;
create unique index if not exists bonus_album_reviews_archive_member_unique_idx
  on public.bonus_album_reviews (archive_album_id, member_id)
  where archive_album_id is not null;

alter table public.bonus_album_reviews
  add constraint bonus_album_reviews_exactly_one_target
  check (num_nonnulls(entry_id, archive_album_id) = 1);

-- Keep the old RPC signatures as wrappers while adding the archive target.
drop function if exists public.save_my_bonus_album_review(uuid, text, text, numeric, text, text);
drop function if exists public.reset_my_bonus_album_review(uuid);

create function public.save_my_bonus_album_review(
  p_entry_id uuid,
  p_archive_album_id text,
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
  current_username text;
  saved_review_id uuid;
begin
  if current_member_id is null then raise exception 'Authentication required'; end if;
  if p_review is null or char_length(btrim(p_review)) = 0 then raise exception 'A review is required'; end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 or p_rating * 2 <> trunc(p_rating * 2) then raise exception 'Rating must be between 0 and 5 in half steps'; end if;
  if num_nonnulls(p_entry_id, p_archive_album_id) <> 1 then raise exception 'Choose exactly one album'; end if;

  select username into current_username from public.member_profiles where id = current_member_id;
  if current_username is null then raise exception 'Member profile not found'; end if;

  if p_entry_id is not null then
    if not exists (
      select 1 from public.club_draw_entries as entry
      join public.member_album_reviews as official_review on official_review.album_id = entry.id::text and official_review.rating is not null
      where entry.id = p_entry_id and entry.listened_by is distinct from current_member_id
        and nullif(btrim(entry.album_title), '') is not null and nullif(btrim(entry.album_artist), '') is not null
    ) then raise exception 'Choose an album officially reviewed by another member'; end if;
    insert into public.bonus_album_reviews (entry_id, archive_album_id, member_id, review_title, review, rating, best_track, worst_track)
    values (p_entry_id, null, current_member_id, nullif(btrim(p_review_title), ''), btrim(p_review), p_rating, nullif(btrim(p_best_track), ''), nullif(btrim(p_worst_track), ''))
    on conflict (entry_id, member_id) where entry_id is not null do update set review_title = excluded.review_title, review = excluded.review, rating = excluded.rating, best_track = excluded.best_track, worst_track = excluded.worst_track
    returning id into saved_review_id;
  else
    if p_archive_album_id !~ '^archive-[0-9]+$' or not exists (
      select 1 from public.archived_album_reviews as archive_review
      where archive_review.album_id = p_archive_album_id
        and archive_review.rating is not null
        and lower(archive_review.listener_username) <> lower(current_username)
    ) then raise exception 'Choose an archived album reviewed by another member'; end if;
    insert into public.bonus_album_reviews (entry_id, archive_album_id, member_id, review_title, review, rating, best_track, worst_track)
    values (null, p_archive_album_id, current_member_id, nullif(btrim(p_review_title), ''), btrim(p_review), p_rating, nullif(btrim(p_best_track), ''), nullif(btrim(p_worst_track), ''))
    on conflict (archive_album_id, member_id) where archive_album_id is not null do update set review_title = excluded.review_title, review = excluded.review, rating = excluded.rating, best_track = excluded.best_track, worst_track = excluded.worst_track
    returning id into saved_review_id;
  end if;
  return saved_review_id;
end;
$$;

create function public.save_my_bonus_album_review(p_entry_id uuid, p_review_title text, p_review text, p_rating numeric, p_best_track text, p_worst_track text)
returns uuid language sql security definer set search_path = public, pg_temp as $$
  select public.save_my_bonus_album_review(p_entry_id, null, p_review_title, p_review, p_rating, p_best_track, p_worst_track);
$$;

create function public.reset_my_bonus_album_review(p_entry_id uuid, p_archive_album_id text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare deleted_review_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if num_nonnulls(p_entry_id, p_archive_album_id) <> 1 then raise exception 'Choose exactly one album'; end if;
  delete from public.bonus_album_reviews where member_id = (select auth.uid()) and ((p_entry_id is not null and entry_id = p_entry_id) or (p_archive_album_id is not null and archive_album_id = p_archive_album_id)) returning id into deleted_review_id;
  if deleted_review_id is null then raise exception 'No bonus review exists for this album'; end if;
  return deleted_review_id;
end;
$$;

create function public.reset_my_bonus_album_review(p_entry_id uuid)
returns uuid language sql security definer set search_path = public, pg_temp as $$
  select public.reset_my_bonus_album_review(p_entry_id, null);
$$;

revoke all on function public.save_my_bonus_album_review(uuid, text, text, text, numeric, text, text) from public, anon;
revoke all on function public.save_my_bonus_album_review(uuid, text, text, numeric, text, text) from public, anon;
revoke all on function public.reset_my_bonus_album_review(uuid, text) from public, anon;
revoke all on function public.reset_my_bonus_album_review(uuid) from public, anon;
grant execute on function public.save_my_bonus_album_review(uuid, text, text, text, numeric, text, text) to authenticated;
grant execute on function public.save_my_bonus_album_review(uuid, text, text, numeric, text, text) to authenticated;
grant execute on function public.reset_my_bonus_album_review(uuid, text) to authenticated;
grant execute on function public.reset_my_bonus_album_review(uuid) to authenticated;

drop function if exists public.get_public_bonus_draw_reviews();
create function public.get_public_bonus_draw_reviews()
returns table (
  entry_id uuid, archive_album_id text, draw_number integer, archive_number integer,
  album_title text, album_artist text, cover_path text, cover_source_url text,
  member_username text, member_display_name text, review_title text, review text,
  rating numeric, best_track text, worst_track text, updated_at timestamptz
)
language sql security invoker set search_path = public, pg_temp as $$
  select bonus.entry_id, bonus.archive_album_id, entry.draw_number, entry.archive_number,
    entry.album_title, entry.album_artist, entry.cover_path, entry.cover_source_url,
    profile.username, profile.display_name, bonus.review_title, bonus.review, bonus.rating,
    bonus.best_track, bonus.worst_track, bonus.updated_at
  from public.bonus_album_reviews as bonus
  join public.club_draw_entries as entry on entry.id = bonus.entry_id
  join public.member_profiles as profile on profile.id = bonus.member_id
  join public.club_draws as draw on draw.draw_number = entry.draw_number
  where draw.status in ('published', 'locked')
  union all
  select null::uuid, bonus.archive_album_id,
    case when number <= 10 then 1 when number <= 19 then 2 when number <= 28 then 3 when number <= 36 then 4 when number <= 45 then 5 else 6 end,
    number, null::text, null::text, null::text, null::text,
    profile.username, profile.display_name, bonus.review_title, bonus.review, bonus.rating,
    bonus.best_track, bonus.worst_track, bonus.updated_at
  from public.bonus_album_reviews as bonus
  join public.member_profiles as profile on profile.id = bonus.member_id
  cross join lateral (select substring(bonus.archive_album_id from '[0-9]+')::integer as number) as parsed
  where bonus.archive_album_id is not null;
$$;
grant execute on function public.get_public_bonus_draw_reviews() to anon, authenticated;
