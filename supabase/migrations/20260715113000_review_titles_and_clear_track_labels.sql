alter table public.member_album_reviews
  add column if not exists review_title text;

alter table public.member_album_reviews
  drop constraint if exists member_album_reviews_review_title_check;

alter table public.member_album_reviews
  add constraint member_album_reviews_review_title_check
  check (review_title is null or char_length(btrim(review_title)) between 1 and 160);

drop function if exists public.get_public_draw_reviews();

create function public.get_public_draw_reviews()
returns table(
  album_id text,
  review_title text,
  review text,
  rating numeric,
  best_track text,
  worst_track text,
  best_track_youtube_music_url text,
  best_track_youtube_url text,
  worst_track_youtube_music_url text,
  worst_track_youtube_url text
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    review.album_id,
    review.review_title,
    review.review,
    review.rating,
    review.best_track,
    review.worst_track,
    best.youtube_music_url,
    best.youtube_url,
    worst.youtube_music_url,
    worst.youtube_url
  from public.member_album_reviews as review
  join public.club_draw_entries as entry on entry.id::text = review.album_id
  join public.club_draws as draw on draw.draw_number = entry.draw_number
  left join public.album_track_selections as best
    on best.review_id = review.id and best.selection_type = 'best'
  left join public.album_track_selections as worst
    on worst.review_id = review.id and worst.selection_type = 'worst'
  where draw.status in ('published', 'locked')
    and entry.album_title is not null
    and entry.album_artist is not null;
$$;

grant execute on function public.get_public_draw_reviews() to anon, authenticated;