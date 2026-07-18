create table public.album_cover_overrides (
  album_id text primary key check (album_id ~ '^archive-[0-9]+$'),
  cover_path text not null check (cover_path ~ '^editorial/archive-[0-9]+/[0-9]{13}\.(jpg|png|webp)$'),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

alter table public.album_cover_overrides enable row level security;

revoke all on table public.album_cover_overrides from anon, authenticated;
grant select on table public.album_cover_overrides to anon, authenticated;
grant insert, update, delete on table public.album_cover_overrides to authenticated;

create policy "Album cover overrides are publicly readable"
  on public.album_cover_overrides for select to anon, authenticated
  using (true);

create policy "Admins manage album cover overrides"
  on public.album_cover_overrides for all to authenticated
  using ((select private.is_member_admin()))
  with check ((select private.is_member_admin()));

create or replace function private.touch_album_cover_override()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_album_cover_override() from public, anon, authenticated;

create trigger album_cover_overrides_touch_updated_at
before update on public.album_cover_overrides
for each row execute function private.touch_album_cover_override();
