create table public.profile_custom_theme_assets (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.member_public_profiles(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  byte_size integer not null,
  width integer not null,
  height integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint profile_custom_theme_assets_mime_check check (mime_type = 'image/webp'),
  constraint profile_custom_theme_assets_size_check check (byte_size between 1 and 1536000),
  constraint profile_custom_theme_assets_width_check check (width between 1 and 2048),
  constraint profile_custom_theme_assets_height_check check (height between 1 and 2048),
  constraint profile_custom_theme_assets_path_check check (
    storage_path = participant_id::text || '/' || id::text || '.webp'
  )
);

create index profile_custom_theme_assets_participant_created_idx
  on public.profile_custom_theme_assets (participant_id, created_at desc);

alter table public.profile_custom_theme_assets enable row level security;

create policy "profile theme asset owners can read metadata"
on public.profile_custom_theme_assets
for select
to authenticated
using (participant_id = (select auth.uid()));

create policy "profile theme asset owners can insert metadata"
on public.profile_custom_theme_assets
for insert
to authenticated
with check (participant_id = (select auth.uid()));

create policy "profile theme asset owners can delete metadata"
on public.profile_custom_theme_assets
for delete
to authenticated
using (participant_id = (select auth.uid()));

revoke all on table public.profile_custom_theme_assets from anon;
revoke all on table public.profile_custom_theme_assets from authenticated;
grant select, insert, delete on table public.profile_custom_theme_assets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-theme-assets',
  'profile-theme-assets',
  false,
  1536000,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "profile theme asset owners can read objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-theme-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "profile theme asset owners can insert objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-theme-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) = 'webp'
);

create policy "profile theme asset owners can delete objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-theme-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
