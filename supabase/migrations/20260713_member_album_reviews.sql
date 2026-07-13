-- Personal review workspace for assigned DOL ZIKLUB albums.
-- Each member may only read and edit their own submitted verdicts.

create table if not exists public.member_album_reviews (
  id uuid primary key default gen_random_uuid(),
  album_id text not null check (char_length(btrim(album_id)) between 1 and 160),
  member_id uuid not null references auth.users(id) on delete cascade,
  review text not null check (char_length(btrim(review)) between 1 and 2000),
  rating numeric(2,1) not null check (rating >= 0 and rating <= 5),
  best_track text check (best_track is null or char_length(btrim(best_track)) between 1 and 160),
  worst_track text check (worst_track is null or char_length(btrim(worst_track)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (album_id, member_id)
);

create index if not exists member_album_reviews_member_id_updated_at_idx
  on public.member_album_reviews (member_id, updated_at desc);

alter table public.member_album_reviews enable row level security;

revoke all on table public.member_album_reviews from anon;
grant select, insert, update on table public.member_album_reviews to authenticated;

drop policy if exists "Members can read their own album reviews" on public.member_album_reviews;
create policy "Members can read their own album reviews"
  on public.member_album_reviews for select to authenticated
  using ((select auth.uid()) = member_id);

drop policy if exists "Members can add their own album reviews" on public.member_album_reviews;
create policy "Members can add their own album reviews"
  on public.member_album_reviews for insert to authenticated
  with check ((select auth.uid()) = member_id);

drop policy if exists "Members can update their own album reviews" on public.member_album_reviews;
create policy "Members can update their own album reviews"
  on public.member_album_reviews for update to authenticated
  using ((select auth.uid()) = member_id)
  with check ((select auth.uid()) = member_id);

create or replace function private.touch_member_album_review()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_member_album_review() from public, anon, authenticated;

drop trigger if exists member_album_reviews_touch_updated_at on public.member_album_reviews;
create trigger member_album_reviews_touch_updated_at
  before update on public.member_album_reviews
  for each row execute procedure private.touch_member_album_review();
