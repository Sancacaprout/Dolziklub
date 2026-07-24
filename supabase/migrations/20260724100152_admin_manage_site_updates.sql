-- Public changelog content, editable only by authenticated club administrators.
create table if not exists public.site_updates (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  published_on date not null,
  display_order integer not null default 0 check (display_order between 0 and 10000),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_updates_publication_idx
  on public.site_updates (published_on desc, display_order asc);

create or replace function private.touch_site_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_site_update() from public, anon, authenticated;

drop trigger if exists touch_site_update_updated_at on public.site_updates;
create trigger touch_site_update_updated_at
  before update on public.site_updates
  for each row execute function private.touch_site_update();

alter table public.site_updates enable row level security;

revoke all on table public.site_updates from anon, authenticated;
grant select on table public.site_updates to anon, authenticated;
grant insert, update, delete on table public.site_updates to authenticated;
grant select, insert, update, delete on table public.site_updates to service_role;

drop policy if exists "Site updates are publicly readable" on public.site_updates;
create policy "Site updates are publicly readable"
  on public.site_updates for select to anon, authenticated
  using (true);

drop policy if exists "Administrators create site updates" on public.site_updates;
create policy "Administrators create site updates"
  on public.site_updates for insert to authenticated
  with check ((select private.is_member_admin()));

drop policy if exists "Administrators update site updates" on public.site_updates;
create policy "Administrators update site updates"
  on public.site_updates for update to authenticated
  using ((select private.is_member_admin()))
  with check ((select private.is_member_admin()));

drop policy if exists "Administrators delete site updates" on public.site_updates;
create policy "Administrators delete site updates"
  on public.site_updates for delete to authenticated
  using ((select private.is_member_admin()));