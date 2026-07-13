-- Music metadata is attached to live draw entries: a confirmed match never relies
-- on a mutable external thumbnail URL alone, and manual/admin corrections win.
alter table public.club_draw_entries
  add column if not exists youtube_playlist_id text,
  add column if not exists youtube_video_id text,
  add column if not exists youtube_music_url text,
  add column if not exists youtube_url text,
  add column if not exists cover_source_url text,
  add column if not exists youtube_published_at timestamptz,
  add column if not exists music_channel_title text,
  add column if not exists music_resource_type text check (music_resource_type is null or music_resource_type in ('playlist', 'video', 'search')),
  add column if not exists music_match_confidence text check (music_match_confidence is null or music_match_confidence in ('high', 'medium', 'low')),
  add column if not exists music_metadata_source text not null default 'manual' check (music_metadata_source in ('automatic', 'member', 'admin', 'import', 'manual')),
  add column if not exists music_metadata_verified boolean not null default false,
  add column if not exists music_metadata_locked boolean not null default false;

grant update (
  youtube_playlist_id, youtube_video_id, youtube_music_url, youtube_url,
  cover_source_url, youtube_published_at, music_channel_title, music_resource_type,
  music_match_confidence, music_metadata_source, music_metadata_verified,
  music_metadata_locked
) on public.club_draw_entries to authenticated;

create or replace function private.prevent_locked_music_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.music_metadata_locked and not private.is_member_admin() and (
    new.album_title is distinct from old.album_title or
    new.album_artist is distinct from old.album_artist or
    new.cover_path is distinct from old.cover_path or
    new.youtube_playlist_id is distinct from old.youtube_playlist_id or
    new.youtube_video_id is distinct from old.youtube_video_id or
    new.youtube_music_url is distinct from old.youtube_music_url or
    new.youtube_url is distinct from old.youtube_url or
    new.cover_source_url is distinct from old.cover_source_url or
    new.music_match_confidence is distinct from old.music_match_confidence
  ) then
    raise exception 'This music metadata has been locked by an administrator';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_locked_music_metadata() from public, anon, authenticated;

drop trigger if exists club_draw_entries_lock_music_metadata on public.club_draw_entries;
create trigger club_draw_entries_lock_music_metadata
  before update on public.club_draw_entries
  for each row execute function private.prevent_locked_music_metadata();

create table if not exists public.album_track_selections (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.club_draw_entries(id) on delete cascade,
  review_id uuid not null references public.member_album_reviews(id) on delete cascade,
  selection_type text not null check (selection_type in ('best', 'worst')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  artist_names text[] not null default '{}',
  youtube_video_id text,
  youtube_music_url text,
  youtube_url text,
  thumbnail_url text,
  source text not null default 'manual' check (source in ('album_tracklist', 'youtube_search', 'manual', 'admin')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, selection_type)
);
create index if not exists album_track_selections_entry_idx on public.album_track_selections(entry_id);
alter table public.album_track_selections enable row level security;
revoke all on table public.album_track_selections from anon, authenticated;
grant select on public.album_track_selections to authenticated;
create policy "Listeners can read their own track selections"
  on public.album_track_selections for select to authenticated
  using (exists (
    select 1 from public.member_album_reviews review
    where review.id = album_track_selections.review_id
      and review.member_id = (select auth.uid())
  ) or private.is_member_admin());

create table if not exists public.music_search_cache (
  id uuid primary key default gen_random_uuid(),
  search_type text not null check (search_type in ('album', 'track')),
  normalized_query text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique(search_type, normalized_query)
);
alter table public.music_search_cache enable row level security;
revoke all on table public.music_search_cache from anon, authenticated;

create table if not exists public.music_search_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  search_type text not null check (search_type in ('album', 'track')),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, search_type)
);
alter table public.music_search_rate_limits enable row level security;
revoke all on table public.music_search_rate_limits from anon, authenticated;

create or replace function public.consume_music_search_quota(p_user_id uuid, p_search_type text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  limiter public.music_search_rate_limits%rowtype;
begin
  if p_search_type not in ('album', 'track') then raise exception 'Invalid music search type'; end if;
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

create table if not exists public.music_metadata_audit_log (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.club_draw_entries(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('album_music_metadata_updated', 'album_cover_replaced', 'album_link_verified', 'best_track_corrected', 'worst_track_corrected')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.music_metadata_audit_log enable row level security;
revoke all on table public.music_metadata_audit_log from anon, authenticated;
grant select on public.music_metadata_audit_log to authenticated;
create policy "Administrators can read music metadata audit"
  on public.music_metadata_audit_log for select to authenticated
  using (private.is_member_admin());

create or replace function private.audit_admin_music_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if private.is_member_admin() and (
    new.album_title is distinct from old.album_title or
    new.album_artist is distinct from old.album_artist or
    new.cover_path is distinct from old.cover_path or
    new.youtube_music_url is distinct from old.youtube_music_url or
    new.youtube_url is distinct from old.youtube_url or
    new.music_metadata_verified is distinct from old.music_metadata_verified or
    new.music_metadata_locked is distinct from old.music_metadata_locked
  ) then
    insert into public.music_metadata_audit_log(entry_id, actor_id, event_type, detail)
    values (new.id, (select auth.uid()), case when new.cover_path is distinct from old.cover_path then 'album_cover_replaced' else 'album_music_metadata_updated' end,
      jsonb_build_object('verified', new.music_metadata_verified, 'locked', new.music_metadata_locked));
  end if;
  return new;
end;
$$;
revoke all on function private.audit_admin_music_metadata() from public, anon, authenticated;
drop trigger if exists club_draw_entries_audit_music_metadata on public.club_draw_entries;
create trigger club_draw_entries_audit_music_metadata
  after update on public.club_draw_entries
  for each row execute function private.audit_admin_music_metadata();

drop function if exists public.get_public_draw_reviews();

create function public.get_public_draw_reviews()
returns table (
  album_id text,
  review text,
  rating numeric,
  best_track text,
  worst_track text,
  best_track_youtube_music_url text,
  best_track_youtube_url text,
  worst_track_youtube_music_url text,
  worst_track_youtube_url text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select review.album_id, review.review, review.rating, review.best_track, review.worst_track,
    best.youtube_music_url, best.youtube_url, worst.youtube_music_url, worst.youtube_url
  from public.member_album_reviews as review
  join public.club_draw_entries as entry on entry.id::text = review.album_id
  join public.club_draws as draw on draw.draw_number = entry.draw_number
  left join public.album_track_selections as best on best.review_id = review.id and best.selection_type = 'best'
  left join public.album_track_selections as worst on worst.review_id = review.id and worst.selection_type = 'worst'
  where draw.status in ('published', 'locked')
    and entry.album_title is not null
    and entry.album_artist is not null;
$$;
revoke all on function public.get_public_draw_reviews() from public;
grant execute on function public.get_public_draw_reviews() to anon, authenticated;
