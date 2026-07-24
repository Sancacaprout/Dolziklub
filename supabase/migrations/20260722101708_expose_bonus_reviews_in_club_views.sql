-- Bonus reviews are displayed alongside the official review, but are not
-- included in any ranking or average. This function exposes only the fields
-- needed by the public tableur and member profile pages.
create or replace function public.get_public_bonus_draw_reviews()
returns table (
  entry_id uuid,
  draw_number integer,
  archive_number integer,
  album_title text,
  album_artist text,
  cover_path text,
  cover_source_url text,
  member_username text,
  member_display_name text,
  review_title text,
  review text,
  rating numeric,
  best_track text,
  worst_track text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    bonus.entry_id,
    entry.draw_number,
    entry.archive_number,
    entry.album_title,
    entry.album_artist,
    entry.cover_path,
    entry.cover_source_url,
    profile.username,
    profile.display_name,
    bonus.review_title,
    bonus.review,
    bonus.rating,
    bonus.best_track,
    bonus.worst_track,
    bonus.updated_at
  from public.bonus_album_reviews as bonus
  join public.club_draw_entries as entry on entry.id = bonus.entry_id
  join public.member_profiles as profile on profile.id = bonus.member_id
  join public.club_draws as draw on draw.draw_number = entry.draw_number
  where draw.status in ('published', 'locked')
    and nullif(btrim(entry.album_title), '') is not null
    and nullif(btrim(entry.album_artist), '') is not null;
$$;

revoke all on function public.get_public_bonus_draw_reviews() from public;
grant execute on function public.get_public_bonus_draw_reviews() to anon, authenticated;
