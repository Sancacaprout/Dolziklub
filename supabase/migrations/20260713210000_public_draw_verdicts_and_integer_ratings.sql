-- The live draw table needs the same public verdict columns as the historical table.
create or replace function public.get_public_draw_reviews()
returns table (
  album_id text,
  review text,
  rating numeric,
  best_track text,
  worst_track text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    review.album_id,
    review.review,
    review.rating,
    review.best_track,
    review.worst_track
  from public.member_album_reviews as review
  join public.club_draw_entries as entry on entry.id::text = review.album_id
  join public.club_draws as draw on draw.draw_number = entry.draw_number
  where draw.status in ('published', 'locked')
    and entry.album_title is not null
    and entry.album_artist is not null;
$$;

revoke all on function public.get_public_draw_reviews() from public;
grant execute on function public.get_public_draw_reviews() to anon, authenticated;

alter table public.member_album_reviews
  drop constraint if exists member_album_reviews_integer_rating;

alter table public.member_album_reviews
  add constraint member_album_reviews_integer_rating
  check (rating = trunc(rating));
