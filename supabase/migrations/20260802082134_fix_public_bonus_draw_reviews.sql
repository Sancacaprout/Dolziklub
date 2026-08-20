begin;

drop function if exists public.get_public_bonus_draw_reviews();
create function public.get_public_bonus_draw_reviews()
returns table (
  entry_id uuid, archive_album_id text, draw_number integer, archive_number integer,
  album_title text, album_artist text, cover_path text, cover_source_url text,
  member_username text, member_display_name text, review_title text, review text,
  rating numeric, best_track text, worst_track text, updated_at timestamptz
)
language sql security definer stable set search_path = '' as $$
  select
    entry.id,
    bonus.archive_album_id,
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
  from public.bonus_album_reviews bonus
  join public.member_profiles profile on profile.id = bonus.member_id
  left join lateral (
    select candidate.*
    from public.club_draw_entries candidate
    join public.club_draws draw on draw.draw_number = candidate.draw_number
    where draw.status in ('published', 'locked')
      and (candidate.id = bonus.entry_id or candidate.source_archive_album_id = bonus.archive_album_id)
    order by case when candidate.id = bonus.entry_id then 0 else 1 end
    limit 1
  ) entry on true
  where entry.id is not null;
$$;

revoke all on function public.get_public_bonus_draw_reviews() from public;
grant execute on function public.get_public_bonus_draw_reviews() to anon, authenticated;

commit;
