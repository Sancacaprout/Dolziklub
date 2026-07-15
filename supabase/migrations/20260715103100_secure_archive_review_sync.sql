-- Le lien entre un tirage et une archive reste privé : aucun client ne peut
-- rediriger son verdict vers une autre fiche d'archive.
create table if not exists private.club_draw_archive_links (
  entry_id uuid primary key references public.club_draw_entries(id) on delete cascade,
  archive_album_id text not null references public.archived_album_reviews(album_id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on table private.club_draw_archive_links from public, anon, authenticated;

insert into private.club_draw_archive_links (entry_id, archive_album_id)
select id, archive_album_id
from public.club_draw_entries
where archive_album_id is not null
on conflict (entry_id) do update set archive_album_id = excluded.archive_album_id;

alter table public.club_draw_entries drop column if exists archive_album_id;

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
    set review = null, rating = null, best_track = null, worst_track = null, is_modified = false
    where album_id = linked_archive_id;
    return old;
  end if;

  update public.archived_album_reviews
  set
    review = new.review,
    rating = new.rating,
    best_track = new.best_track,
    worst_track = new.worst_track,
    is_modified = true
  where album_id = linked_archive_id;

  return new;
end;
$$;

revoke all on function private.sync_draw_review_to_archive_card() from public, anon, authenticated;

drop trigger if exists member_album_reviews_sync_archive_card on public.member_album_reviews;
create trigger member_album_reviews_sync_archive_card
  after insert or update or delete on public.member_album_reviews
  for each row execute procedure private.sync_draw_review_to_archive_card();

-- Rattrape les verdicts saisis avant l'installation du déclencheur.
update public.archived_album_reviews as archive_review
set
  review = live_review.review,
  rating = live_review.rating,
  best_track = live_review.best_track,
  worst_track = live_review.worst_track,
  is_modified = true
from private.club_draw_archive_links as archive_link
join public.member_album_reviews as live_review
  on live_review.album_id = archive_link.entry_id::text
where archive_review.album_id = archive_link.archive_album_id;
