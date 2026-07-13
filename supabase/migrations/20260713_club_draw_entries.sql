-- Live DOL ZIKLUB draws. A slot has a proposer, a listener and (later) an album.
create table if not exists public.club_draw_entries (
  id uuid primary key default gen_random_uuid(),
  draw_number integer not null check (draw_number >= 1),
  position integer not null check (position >= 1),
  proposed_by uuid references auth.users(id) on delete set null,
  listened_by uuid references auth.users(id) on delete set null,
  proposed_by_name text,
  listened_by_name text,
  album_title text check (album_title is null or char_length(btrim(album_title)) between 1 and 180),
  album_artist text check (album_artist is null or char_length(btrim(album_artist)) between 1 and 180),
  cover_path text check (cover_path is null or char_length(btrim(cover_path)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draw_number, position)
);

create index if not exists club_draw_entries_proposer_idx on public.club_draw_entries (proposed_by, draw_number desc);
create index if not exists club_draw_entries_listener_idx on public.club_draw_entries (listened_by, draw_number desc);

alter table public.club_draw_entries enable row level security;

revoke all on table public.club_draw_entries from anon, authenticated;
grant select (id, draw_number, position, proposed_by_name, listened_by_name, album_title, album_artist, cover_path, created_at, updated_at) on public.club_draw_entries to anon;
grant select (id, draw_number, position, proposed_by, listened_by, proposed_by_name, listened_by_name, album_title, album_artist, cover_path, created_at, updated_at) on public.club_draw_entries to authenticated;
grant update (album_title, album_artist, cover_path, updated_at) on public.club_draw_entries to authenticated;

create policy "Live draws are publicly readable"
  on public.club_draw_entries for select to anon, authenticated
  using (true);

create policy "Proposers can complete their own draw slots"
  on public.club_draw_entries for update to authenticated
  using ((select auth.uid()) = proposed_by)
  with check ((select auth.uid()) = proposed_by);

create or replace function private.touch_club_draw_entry()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_club_draw_entry() from public, anon, authenticated;

drop trigger if exists club_draw_entries_touch_updated_at on public.club_draw_entries;
create trigger club_draw_entries_touch_updated_at
  before update on public.club_draw_entries
  for each row execute procedure private.touch_club_draw_entry();

create or replace function private.require_draw_admin()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.is_member_admin() then
    raise exception 'Administrator access is required';
  end if;
end;
$$;

create or replace function public.admin_create_club_draw(p_entry_count integer default 8)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_draw integer;
begin
  perform private.require_draw_admin();
  if p_entry_count < 1 or p_entry_count > 20 then
    raise exception 'A draw must contain between 1 and 20 slots';
  end if;
  select coalesce(max(draw_number), 0) + 1 into next_draw from public.club_draw_entries;
  insert into public.club_draw_entries (draw_number, position)
  select next_draw, series from generate_series(1, p_entry_count) as series;
  return next_draw;
end;
$$;

create or replace function public.admin_update_club_draw_entry(
  p_entry_id uuid,
  p_proposer_username text,
  p_listener_username text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proposer record;
  listener record;
begin
  perform private.require_draw_admin();

  if nullif(btrim(p_proposer_username), '') is not null then
    select id, username into proposer from public.member_profiles where lower(username) = lower(btrim(p_proposer_username));
    if proposer.id is null then raise exception 'Unknown proposer'; end if;
  end if;
  if nullif(btrim(p_listener_username), '') is not null then
    select id, username into listener from public.member_profiles where lower(username) = lower(btrim(p_listener_username));
    if listener.id is null then raise exception 'Unknown listener'; end if;
  end if;

  update public.club_draw_entries
     set proposed_by = proposer.id,
         listened_by = listener.id,
         proposed_by_name = proposer.username,
         listened_by_name = listener.username
   where id = p_entry_id;
  if not found then raise exception 'Unknown draw slot'; end if;
end;
$$;

create or replace function public.admin_delete_club_draw(p_draw_number integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_draw_admin();
  delete from public.club_draw_entries where draw_number = p_draw_number;
end;
$$;

revoke all on function private.require_draw_admin() from public, anon, authenticated;
revoke all on function public.admin_create_club_draw(integer) from public, anon;
revoke all on function public.admin_update_club_draw_entry(uuid, text, text) from public, anon;
revoke all on function public.admin_delete_club_draw(integer) from public, anon;
grant execute on function public.admin_create_club_draw(integer) to authenticated;
grant execute on function public.admin_update_club_draw_entry(uuid, text, text) to authenticated;
grant execute on function public.admin_delete_club_draw(integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album-covers', 'album-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Proposers can upload their album cover"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'album-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Album covers are public"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'album-covers');

create or replace function private.enforce_assigned_draw_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.club_draw_entries
     where id::text = new.album_id
       and listened_by = new.member_id
       and album_title is not null
       and album_artist is not null
  ) then
    raise exception 'Only the assigned listener can submit a review for a completed draw slot';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_assigned_draw_review() from public, anon, authenticated;
drop trigger if exists member_album_reviews_enforce_assignment on public.member_album_reviews;
create trigger member_album_reviews_enforce_assignment
  before insert or update on public.member_album_reviews
  for each row execute function private.enforce_assigned_draw_review();
