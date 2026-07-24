-- Public profile additions: a ranked Deezer artist podium and a normalized
-- YouTube clip id. User-controlled iframe markup or arbitrary embed URLs are
-- deliberately never stored.

alter table public.member_public_profiles
  add column if not exists favorite_clip_youtube_id text;

alter table public.member_public_profiles
  drop constraint if exists member_public_profiles_favorite_clip_youtube_id_check;

alter table public.member_public_profiles
  add constraint member_public_profiles_favorite_clip_youtube_id_check check (
    favorite_clip_youtube_id is null
    or favorite_clip_youtube_id ~ '^[A-Za-z0-9_-]{11}$'
  );

create table if not exists public.profile_favorite_artists (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.member_public_profiles(id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  artist_name text not null check (char_length(btrim(artist_name)) between 1 and 180),
  artist_name_key text generated always as (
    lower(regexp_replace(btrim(artist_name), '\s+', ' ', 'g'))
  ) stored,
  deezer_artist_id bigint check (deezer_artist_id is null or deezer_artist_id > 0),
  deezer_url text check (
    deezer_url is null
    or deezer_url ~ '^https://(www\.)?deezer\.com/artist/[0-9]+/?$'
  ),
  image_path text check (
    image_path is null
    or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/artist\.(jpg|png|webp)$'
  ),
  image_url text check (
    image_url is null
    or (char_length(btrim(image_url)) between 1 and 1200 and image_url ~ '^https://')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, rank),
  unique (participant_id, artist_name_key)
);

create unique index if not exists profile_favorite_artists_participant_deezer_idx
  on public.profile_favorite_artists (participant_id, deezer_artist_id)
  where deezer_artist_id is not null;

create index if not exists profile_favorite_artists_participant_rank_idx
  on public.profile_favorite_artists (participant_id, rank);

alter table public.profile_favorite_artists enable row level security;
revoke all on public.profile_favorite_artists from anon, authenticated;
grant select on public.profile_favorite_artists to anon, authenticated;
grant insert, update, delete on public.profile_favorite_artists to authenticated;

create policy "Public favorite artists are readable"
  on public.profile_favorite_artists for select to anon, authenticated
  using (true);

create policy "Authenticated members insert favorite artists"
  on public.profile_favorite_artists for insert to authenticated
  with check (
    participant_id = (select auth.uid())
    or (select private.is_member_admin())
  );

create policy "Authenticated members update favorite artists"
  on public.profile_favorite_artists for update to authenticated
  using (
    participant_id = (select auth.uid())
    or (select private.is_member_admin())
  )
  with check (
    participant_id = (select auth.uid())
    or (select private.is_member_admin())
  );

create policy "Authenticated members delete favorite artists"
  on public.profile_favorite_artists for delete to authenticated
  using (
    participant_id = (select auth.uid())
    or (select private.is_member_admin())
  );

create or replace function private.enforce_profile_favorite_artist()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'A favorite artist identifier cannot be changed';
  end if;
  new.artist_name := btrim(new.artist_name);
  new.image_path := nullif(btrim(coalesce(new.image_path, '')), '');
  new.image_url := nullif(btrim(coalesce(new.image_url, '')), '');
  if new.deezer_artist_id is null then
    new.deezer_url := null;
  else
    new.deezer_url := 'https://www.deezer.com/artist/' || new.deezer_artist_id::text;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_profile_favorite_artist() from public, anon, authenticated;

create trigger profile_favorite_artists_validate
  before insert or update on public.profile_favorite_artists
  for each row execute function private.enforce_profile_favorite_artist();

-- Album covers and manually replaced artist portraits share the existing public
-- profile-favorites bucket while keeping the same member-owned path boundary.
drop policy if exists "Members upload their favorite covers" on storage.objects;
create policy "Members upload their favorite covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(cover|artist)\.(jpg|png|webp)$'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_member_admin())
    )
  );

drop policy if exists "Members read their favorite cover objects" on storage.objects;
create policy "Members read their favorite cover objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(cover|artist)\.(jpg|png|webp)$'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_member_admin())
    )
  );

drop policy if exists "Members update their favorite covers" on storage.objects;
create policy "Members update their favorite covers"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(cover|artist)\.(jpg|png|webp)$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_member_admin()))
  )
  with check (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(cover|artist)\.(jpg|png|webp)$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_member_admin()))
  );

drop policy if exists "Members remove their favorite covers" on storage.objects;
create policy "Members remove their favorite covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(cover|artist)\.(jpg|png|webp)$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_member_admin()))
  );

-- Artist searches use the same five-minute limiter as albums and tracks, but
-- retain an independent counter.
alter table public.music_search_rate_limits
  drop constraint if exists music_search_rate_limits_search_type_check;

alter table public.music_search_rate_limits
  add constraint music_search_rate_limits_search_type_check
  check (search_type in ('album', 'track', 'artist'));

create or replace function public.consume_music_search_quota(p_user_id uuid, p_search_type text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  limiter public.music_search_rate_limits%rowtype;
begin
  if p_search_type not in ('album', 'track', 'artist') then
    raise exception 'Invalid music search type';
  end if;
  insert into public.music_search_rate_limits (user_id, search_type, request_count)
  values (p_user_id, p_search_type, 0)
  on conflict (user_id, search_type) do nothing;
  select * into limiter from public.music_search_rate_limits
  where user_id = p_user_id and search_type = p_search_type for update;
  if limiter.window_started_at < now() - interval '5 minutes' then
    update public.music_search_rate_limits set window_started_at = now(), request_count = 1
    where user_id = p_user_id and search_type = p_search_type;
    return true;
  end if;
  if limiter.request_count >= 12 then return false; end if;
  update public.music_search_rate_limits set request_count = request_count + 1
  where user_id = p_user_id and search_type = p_search_type;
  return true;
end;
$$;

revoke all on function public.consume_music_search_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_music_search_quota(uuid, text) to service_role;
