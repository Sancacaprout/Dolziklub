-- Le titre saisi avec le verdict devient l'accroche de la fiche d'archive.
alter table public.archived_album_reviews
  add column if not exists review_title text;

create or replace function private.sync_draw_review_to_archive_card()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  linked_archive_id text;
  reviewed_entry_id text;
begin
  reviewed_entry_id := case when tg_op = 'DELETE' then old.album_id else new.album_id end;

  select archive_album_id into linked_archive_id
  from private.club_draw_archive_links
  where entry_id::text = reviewed_entry_id;

  if linked_archive_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.archived_album_reviews
    set review_title = null, review = null, rating = null, best_track = null, worst_track = null, is_modified = false
    where album_id = linked_archive_id;
    return old;
  end if;

  update public.archived_album_reviews
  set
    review_title = new.review_title,
    review = new.review,
    rating = new.rating,
    best_track = new.best_track,
    worst_track = new.worst_track,
    is_modified = true
  where album_id = linked_archive_id;

  return new;
end;
$$;

update public.archived_album_reviews as archive_review
set
  review_title = live_review.review_title,
  review = live_review.review,
  rating = live_review.rating,
  best_track = live_review.best_track,
  worst_track = live_review.worst_track,
  is_modified = true
from private.club_draw_archive_links as archive_link
join public.member_album_reviews as live_review
  on live_review.album_id = archive_link.entry_id::text
where archive_review.album_id = archive_link.archive_album_id;
