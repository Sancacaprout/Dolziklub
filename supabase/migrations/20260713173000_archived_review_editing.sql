-- Archived verdicts are public club data, but only the listener assigned to an
-- album may revise its verdict. The assignment is seeded from the club archive.
create table if not exists public.archived_album_reviews (
  album_id text primary key check (album_id ~ '^archive-[0-9]+$'),
  listener_username text not null check (char_length(btrim(listener_username)) between 2 and 82),
  review text,
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  best_track text check (best_track is null or char_length(btrim(best_track)) between 1 and 160),
  worst_track text check (worst_track is null or char_length(btrim(worst_track)) between 1 and 160),
  is_modified boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.archived_album_reviews (album_id, listener_username)
values
  ('archive-1', 'kougna'),
  ('archive-2', 'enzo'),
  ('archive-3', 'motem'),
  ('archive-4', 'dod'),
  ('archive-5', 'pep'),
  ('archive-6', 'yuna'),
  ('archive-7', 'chacha'),
  ('archive-8', 'yuna'),
  ('archive-9', 'bono'),
  ('archive-10', 'toma'),
  ('archive-11', 'chacha'),
  ('archive-12', 'toma'),
  ('archive-13', 'pep'),
  ('archive-14', 'bono'),
  ('archive-15', 'yuna'),
  ('archive-16', 'motem'),
  ('archive-17', 'enzo'),
  ('archive-18', 'dod'),
  ('archive-19', 'dod'),
  ('archive-20', 'motem'),
  ('archive-21', 'toma'),
  ('archive-22', 'dod'),
  ('archive-23', 'enzo'),
  ('archive-24', 'bono'),
  ('archive-25', 'chacha'),
  ('archive-26', 'pep'),
  ('archive-27', 'pep'),
  ('archive-28', 'yuna'),
  ('archive-29', 'alain'),
  ('archive-30', 'dod'),
  ('archive-31', 'toma'),
  ('archive-32', 'motem'),
  ('archive-33', 'chacha'),
  ('archive-34', 'yuna'),
  ('archive-35', 'pep'),
  ('archive-36', 'enzo'),
  ('archive-37', 'bono'),
  ('archive-38', 'motem'),
  ('archive-39', 'chacha'),
  ('archive-40', 'toma'),
  ('archive-41', 'pep'),
  ('archive-42', 'bono'),
  ('archive-43', 'yuna'),
  ('archive-44', 'enzo'),
  ('archive-45', 'dod'),
  ('archive-46', 'toma'),
  ('archive-47', 'pep'),
  ('archive-48', 'yuna'),
  ('archive-49', 'dod')
on conflict (album_id) do nothing;

create or replace function private.is_current_member_username(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.member_profiles
    where id = (select auth.uid())
      and lower(username) = lower(p_username)
  );
$$;

revoke all on function private.is_current_member_username(text) from public, anon, authenticated;

create or replace function private.touch_archived_album_review()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.is_modified := true;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_archived_album_review() from public, anon, authenticated;

drop trigger if exists archived_album_reviews_touch_updated_at on public.archived_album_reviews;
create trigger archived_album_reviews_touch_updated_at
  before update on public.archived_album_reviews
  for each row execute procedure private.touch_archived_album_review();

alter table public.archived_album_reviews enable row level security;

revoke all on table public.archived_album_reviews from anon, authenticated;
grant select on table public.archived_album_reviews to anon, authenticated;
grant update (review, rating, best_track, worst_track) on table public.archived_album_reviews to authenticated;

drop policy if exists "Archived reviews are visible to the club" on public.archived_album_reviews;
create policy "Archived reviews are visible to the club"
  on public.archived_album_reviews for select to anon, authenticated
  using (true);

drop policy if exists "Listeners can revise their archived reviews" on public.archived_album_reviews;
create policy "Listeners can revise their archived reviews"
  on public.archived_album_reviews for update to authenticated
  using ((select private.is_current_member_username(listener_username)))
  with check ((select private.is_current_member_username(listener_username)));
