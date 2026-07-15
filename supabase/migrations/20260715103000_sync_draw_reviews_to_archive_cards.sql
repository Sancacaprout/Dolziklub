-- Synchronise les verdicts d'un tirage avec la fiche d'archive associée.
alter table public.club_draw_entries
  add column if not exists archive_album_id text
  references public.archived_album_reviews(album_id)
  on delete set null;

create index if not exists club_draw_entries_archive_album_id_idx
  on public.club_draw_entries (archive_album_id)
  where archive_album_id is not null;

update public.club_draw_entries
set archive_album_id = case
  when lower(btrim(album_title)) = 'yeezus' and lower(btrim(album_artist)) = 'kanye west' then 'archive-46'
  when lower(btrim(album_title)) = 'pleins phares, pt. 2' and lower(btrim(album_artist)) = 'favé' then 'archive-47'
  when lower(btrim(album_title)) = '6 feet beneath the moon' and lower(btrim(album_artist)) = 'king krule' then 'archive-48'
  when lower(btrim(album_title)) = 'fantasyland' and lower(btrim(album_artist)) = 'mr.fantasy' then 'archive-49'
  else archive_album_id
end
where archive_album_id is null;

create or replace function private.touch_archived_album_review()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.is_modified is not distinct from old.is_modified then
    new.is_modified := true;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

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
  from public.club_draw_entries
  where id::text = reviewed_entry_id;

  if linked_archive_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    update public.archived_album_reviews
    set review = null, rating = null, best_track = null, worst_track = null, is_modified = false
    where album_id = linked_archive_id;
  else
    update public.archived_album_reviews
    set review = new.review, rating = new.rating, best_track = new.best_track, worst_track = new.worst_track, is_modified = true
    where album_id = linked_archive_id;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.sync_draw_review_to_archive_card() from public, anon, authenticated;

drop trigger if exists member_album_reviews_sync_archive_card on public.member_album_reviews;
create trigger member_album_reviews_sync_archive_card
  after insert or update or delete on public.member_album_reviews
  for each row execute procedure private.sync_draw_review_to_archive_card();
