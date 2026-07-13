-- DOL ZIKLUB — comptes membres et rôles.
-- Appliquer cette migration avant `npm run generate:credentials -- --apply`.

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9]+$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  role text not null check (role in ('member', 'admin')) default 'member',
  created_at timestamptz not null default now()
);

alter table public.member_profiles enable row level security;

create or replace function public.handle_new_member_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_username text;
  safe_display_name text;
  safe_role text;
begin
  safe_username := lower(regexp_replace(coalesce(new.raw_app_meta_data ->> 'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9]', '', 'g'));
  safe_display_name := left(coalesce(nullif(new.raw_app_meta_data ->> 'display_name', ''), safe_username), 80);
  safe_role := case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'member' end;

  if safe_username = '' then
    raise exception 'A username is required to create a member profile';
  end if;

  insert into public.member_profiles (id, username, display_name, role)
  values (new.id, safe_username, safe_display_name, safe_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_member_profile on auth.users;
create trigger on_auth_user_created_member_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_member_profile();

create or replace function public.is_member_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.member_profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_member_admin() from public;
grant execute on function public.is_member_admin() to authenticated;

revoke all on table public.member_profiles from anon, authenticated;
grant select on table public.member_profiles to authenticated;

drop policy if exists "Members can read their own profile" on public.member_profiles;
create policy "Members can read their own profile"
  on public.member_profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Admins can read all member profiles" on public.member_profiles;
create policy "Admins can read all member profiles"
  on public.member_profiles for select to authenticated
  using ((select public.is_member_admin()));
