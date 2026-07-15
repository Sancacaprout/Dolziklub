-- Profile presentation and favorites. This migration keeps the existing public
-- profile as the source of identity and adds only member-owned presentation data.

alter table public.member_public_profiles
  add column if not exists profile_theme text not null default 'archive';

alter table public.member_public_profiles
  drop constraint if exists member_public_profiles_profile_theme_check;

alter table public.member_public_profiles
  add constraint member_public_profiles_profile_theme_check check (
    profile_theme in (
      'archive', 'dark-vinyl', 'fanzine', 'neon-club', 'natural-tape',
      'chrome-2000', 'city-pop', 'punk-poster', 'jazz-lounge', 'acid-rave'
    )
  );

-- Preserve the existing username safeguard while allowing an administrator to
-- correct another member's profile fields.
create or replace function private.enforce_member_public_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  expected_username text;
begin
  if (select auth.uid()) is not null
     and new.id <> (select auth.uid())
     and not private.is_member_admin() then
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
revoke all on function private.enforce_member_public_profile_identity() from public, anon, authenticated;

-- Administrators keep the same profile table, but can correct a member's theme.
drop policy if exists "Administrators update public member cards" on public.member_public_profiles;
create policy "Administrators update public member cards"
  on public.member_public_profiles for update to authenticated
  using ((select private.is_member_admin()))
  with check ((select private.is_member_admin()));

create table if not exists public.profile_favorite_albums (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.member_public_profiles(id) on delete cascade,
  -- The live catalogue currently consists of club_draw_entries. The nullable
  -- reference lets a draw be deleted without deleting a profile preference.
  source_album_id uuid references public.club_draw_entries(id) on delete set null,
  source_catalog_key text check (source_catalog_key is null or char_length(btrim(source_catalog_key)) between 1 and 180),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  artist_name text not null check (char_length(btrim(artist_name)) between 1 and 180),
  cover_path text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover\.(jpg|png|webp)$'),
  cover_source_url text check (cover_source_url is null or (char_length(btrim(cover_source_url)) between 1 and 1200 and cover_source_url ~ '^(https://|/)')),
  display_order smallint not null check (display_order between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(participant_id, display_order)
);

create index if not exists profile_favorite_albums_participant_order_idx
  on public.profile_favorite_albums (participant_id, display_order);

alter table public.profile_favorite_albums enable row level security;
revoke all on public.profile_favorite_albums from anon, authenticated;
grant select on public.profile_favorite_albums to anon, authenticated;
grant insert, update, delete on public.profile_favorite_albums to authenticated;

create policy "Public favorite albums are readable"
  on public.profile_favorite_albums for select to anon, authenticated
  using (true);

create policy "Members manage their own favorite albums"
  on public.profile_favorite_albums for all to authenticated
  using (participant_id = (select auth.uid()))
  with check (participant_id = (select auth.uid()));

create policy "Administrators manage all favorite albums"
  on public.profile_favorite_albums for all to authenticated
  using ((select private.is_member_admin()))
  with check ((select private.is_member_admin()));

create or replace function private.enforce_profile_favorite_album()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'A favorite album identifier cannot be changed';
  end if;
  if (select auth.uid()) is not null
     and new.participant_id <> (select auth.uid())
     and not private.is_member_admin() then
    raise exception 'A member can only manage their own favorite albums';
  end if;
  new.title := btrim(new.title);
  new.artist_name := btrim(new.artist_name);
  new.cover_source_url := nullif(btrim(coalesce(new.cover_source_url, '')), '');
  new.source_catalog_key := nullif(btrim(coalesce(new.source_catalog_key, '')), '');
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.enforce_profile_favorite_album() from public, anon, authenticated;

drop trigger if exists profile_favorite_albums_validate on public.profile_favorite_albums;
create trigger profile_favorite_albums_validate
  before insert or update on public.profile_favorite_albums
  for each row execute function private.enforce_profile_favorite_album();

-- A dedicated public bucket keeps profile covers isolated from draw artwork.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-favorites', 'profile-favorites', true, 3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Members upload their favorite covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover\.(jpg|png|webp)$'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_member_admin())
    )
  );

create policy "Members read their favorite cover objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover\.(jpg|png|webp)$'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_member_admin())
    )
  );

create policy "Members update their favorite covers"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover\.(jpg|png|webp)$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_member_admin()))
  )
  with check (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover\.(jpg|png|webp)$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_member_admin()))
  );

create policy "Members remove their favorite covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover\.(jpg|png|webp)$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_member_admin()))
  );

create table if not exists public.profile_audit_log (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.member_public_profiles(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'profile_theme_updated', 'profile_theme_reset', 'favorite_album_added',
    'favorite_album_updated', 'favorite_album_removed'
  )),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.profile_audit_log enable row level security;
revoke all on public.profile_audit_log from anon, authenticated;
grant select on public.profile_audit_log to authenticated;
create policy "Administrators read profile audit logs"
  on public.profile_audit_log for select to authenticated
  using ((select private.is_member_admin()));

create or replace function private.audit_profile_admin_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  event_name text;
  affected_id uuid;
begin
  if not private.is_member_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_table_name = 'member_public_profiles' then
    if new.profile_theme is distinct from old.profile_theme then
      insert into public.profile_audit_log (participant_id, actor_id, event_type, detail)
      values (new.id, (select auth.uid()),
        case when new.profile_theme = 'archive' then 'profile_theme_reset' else 'profile_theme_updated' end,
        jsonb_build_object('previous_theme', old.profile_theme, 'profile_theme', new.profile_theme));
    end if;
  else
    event_name := case tg_op
      when 'INSERT' then 'favorite_album_added'
      when 'UPDATE' then 'favorite_album_updated'
      else 'favorite_album_removed'
    end;
    if tg_op = 'DELETE' then
      affected_id := old.participant_id;
      insert into public.profile_audit_log (participant_id, actor_id, event_type, detail)
      values (affected_id, (select auth.uid()), event_name,
        jsonb_build_object('favorite_id', old.id, 'title', old.title));
    else
      affected_id := new.participant_id;
      insert into public.profile_audit_log (participant_id, actor_id, event_type, detail)
      values (affected_id, (select auth.uid()), event_name,
        jsonb_build_object('favorite_id', new.id, 'title', new.title));
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.audit_profile_admin_changes() from public, anon, authenticated;

drop trigger if exists member_public_profiles_audit_theme on public.member_public_profiles;
create trigger member_public_profiles_audit_theme
  after update on public.member_public_profiles
  for each row execute function private.audit_profile_admin_changes();

drop trigger if exists profile_favorite_albums_audit on public.profile_favorite_albums;
create trigger profile_favorite_albums_audit
  after insert or update or delete on public.profile_favorite_albums
  for each row execute function private.audit_profile_admin_changes();
