-- Moves privileged helpers out of the exposed public schema.
-- This migration also hardens projects where member_auth was already applied.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.handle_new_member_profile()
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

revoke all on function private.handle_new_member_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_member_profile on auth.users;
create trigger on_auth_user_created_member_profile
  after insert on auth.users
  for each row execute procedure private.handle_new_member_profile();

create or replace function private.is_member_admin()
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

revoke all on function private.is_member_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_member_admin() to authenticated;

drop policy if exists "Admins can read all member profiles" on public.member_profiles;
create policy "Admins can read all member profiles"
  on public.member_profiles for select to authenticated
  using ((select private.is_member_admin()));

drop function if exists public.handle_new_member_profile();
drop function if exists public.is_member_admin();
