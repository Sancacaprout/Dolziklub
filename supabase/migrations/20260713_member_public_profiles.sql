-- Public member cards: avatar, short bio and Kouize answers.
-- Roles and account credentials remain in the private member_profiles table.

create table if not exists public.member_public_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9]+$'),
  avatar_path text check (avatar_path is null or char_length(avatar_path) between 1 and 512),
  bio text check (bio is null or char_length(btrim(bio)) between 1 and 280),
  kouize jsonb not null default '{}'::jsonb check (jsonb_typeof(kouize) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_public_profiles enable row level security;

grant select on table public.member_public_profiles to anon, authenticated;
grant insert, update on table public.member_public_profiles to authenticated;

drop policy if exists "Public member cards are readable" on public.member_public_profiles;
create policy "Public member cards are readable"
  on public.member_public_profiles for select to anon, authenticated
  using (true);

drop policy if exists "Members create their own public card" on public.member_public_profiles;
create policy "Members create their own public card"
  on public.member_public_profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Members update their own public card" on public.member_public_profiles;
create policy "Members update their own public card"
  on public.member_public_profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function private.enforce_member_public_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  expected_username text;
begin
  if (select auth.uid()) is not null and new.id <> (select auth.uid()) then
    raise exception 'A member can only change their own public profile';
  end if;

  select username into expected_username
  from public.member_profiles
  where id = new.id;

  if expected_username is null or new.username <> expected_username then
    raise exception 'The public profile username must match the member account';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.create_member_public_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.member_public_profiles (id, username)
  values (new.id, new.username)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.enforce_member_public_profile_identity() from public, anon, authenticated;
revoke all on function private.create_member_public_profile() from public, anon, authenticated;

drop trigger if exists member_public_profiles_enforce_identity on public.member_public_profiles;
create trigger member_public_profiles_enforce_identity
  before insert or update on public.member_public_profiles
  for each row execute procedure private.enforce_member_public_profile_identity();

drop trigger if exists member_profiles_create_public_profile on public.member_profiles;
create trigger member_profiles_create_public_profile
  after insert on public.member_profiles
  for each row execute procedure private.create_member_public_profile();

insert into public.member_public_profiles (id, username, kouize)
select
  profile.id,
  profile.username,
  case profile.username
    when 'thomas' then jsonb_build_object('default_style', 'Rap', 'dislikes', 'Métal', 'curious_about', 'Jazz', 'first_hook', 'La mélodie', 'note', 'La prod intrigue, les paroles font rester.')
    when 'pep' then jsonb_build_object('curious_about', 'Musique mongole', 'first_hook', 'L’ambiance', 'note', 'Les émotions frr.')
    when 'motem' then jsonb_build_object('default_style', 'Tout', 'dislikes', 'Autotune bien dégueu')
    when 'dod' then jsonb_build_object('default_style', 'Rock', 'dislikes', 'Classique', 'curious_about', 'Folk', 'first_hook', 'La mélodie', 'note', 'Plus précisément les suites d’accords.')
    when 'yuna' then jsonb_build_object('default_style', 'Pop', 'dislikes', 'Rap', 'curious_about', 'Expérimental', 'first_hook', 'La mélodie', 'note', 'Rap de la street bof.')
    when 'chacha' then jsonb_build_object('default_style', 'Rock', 'curious_about', 'Jazz', 'first_hook', 'La rythmique')
    when 'kougna' then jsonb_build_object('default_style', 'Hip-hop', 'dislikes', 'Il y a du bon dans tout', 'curious_about', 'Tout', 'first_hook', 'L’ambiance', 'note', 'Le rock arrive en 2e.')
    when 'alain' then jsonb_build_object('default_style', 'Instrumental', 'dislikes', 'Rap', 'first_hook', 'L’ambiance', 'note', 'Une musique avec une âme, les changements de tonalité qui surprennent.')
    else '{}'::jsonb
  end
from public.member_profiles profile
on conflict (id) do update
set username = excluded.username,
    kouize = case when public.member_public_profiles.kouize = '{}'::jsonb then excluded.kouize else public.member_public_profiles.kouize end;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-avatars',
  'member-avatars',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members view their own avatar objects" on storage.objects;
create policy "Members view their own avatar objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Members upload their own avatar" on storage.objects;
create policy "Members upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Members update their own avatar" on storage.objects;
create policy "Members update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Members remove their own avatar" on storage.objects;
create policy "Members remove their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
