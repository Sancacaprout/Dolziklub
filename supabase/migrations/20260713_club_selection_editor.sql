-- Editable selection sheet for DOL ZIKLUB administrators.
-- Public readers can inspect the sheet, while edits remain restricted by RLS.

create table if not exists public.club_selection_rows (
  id uuid primary key default gen_random_uuid(),
  position integer not null unique check (position >= 1),
  members text[] not null check (cardinality(members) = 3),
  is_locked boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.club_selection_rows enable row level security;

grant select on table public.club_selection_rows to anon, authenticated;
grant insert, update, delete on table public.club_selection_rows to authenticated;

drop policy if exists "Selection rows are publicly readable" on public.club_selection_rows;
create policy "Selection rows are publicly readable"
  on public.club_selection_rows for select to anon, authenticated
  using (true);

drop policy if exists "Admins can add selection rows" on public.club_selection_rows;
create policy "Admins can add selection rows"
  on public.club_selection_rows for insert to authenticated
  with check ((select private.is_member_admin()));

drop policy if exists "Admins can update selection rows" on public.club_selection_rows;
create policy "Admins can update selection rows"
  on public.club_selection_rows for update to authenticated
  using ((select private.is_member_admin()))
  with check ((select private.is_member_admin()));

drop policy if exists "Admins can remove selection rows" on public.club_selection_rows;
create policy "Admins can remove selection rows"
  on public.club_selection_rows for delete to authenticated
  using ((select private.is_member_admin()));

create or replace function private.touch_club_selection_row()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.prevent_locked_club_selection_row_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.is_locked and (
    new.members is distinct from old.members
    or new.position is distinct from old.position
  ) then
    raise exception 'Unlock this selection before changing its members or position';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_locked_club_selection_row_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.is_locked then
    raise exception 'Unlock this selection before deleting it';
  end if;
  return old;
end;
$$;

revoke all on function private.touch_club_selection_row() from public, anon, authenticated;
revoke all on function private.prevent_locked_club_selection_row_change() from public, anon, authenticated;
revoke all on function private.prevent_locked_club_selection_row_delete() from public, anon, authenticated;

drop trigger if exists club_selection_rows_touch_updated_at on public.club_selection_rows;
create trigger club_selection_rows_touch_updated_at
  before update on public.club_selection_rows
  for each row execute procedure private.touch_club_selection_row();

drop trigger if exists club_selection_rows_prevent_locked_change on public.club_selection_rows;
create trigger club_selection_rows_prevent_locked_change
  before update on public.club_selection_rows
  for each row execute procedure private.prevent_locked_club_selection_row_change();

drop trigger if exists club_selection_rows_prevent_locked_delete on public.club_selection_rows;
create trigger club_selection_rows_prevent_locked_delete
  before delete on public.club_selection_rows
  for each row execute procedure private.prevent_locked_club_selection_row_delete();

insert into public.club_selection_rows (position, members)
values
  (1, array['Toma', 'Yuna', 'Enzo']),
  (2, array['Pep', 'Dod', 'Toma']),
  (3, array['Motem', 'Enzo', 'Motem']),
  (4, array['Chacha', 'Toma', 'Pep']),
  (5, array['Dod', 'Motem', 'Yuna']),
  (6, array['Yuna', 'Pep', 'Dod']),
  (7, array['Enzo', '—', '—'])
on conflict (position) do nothing;
