create table if not exists public.profile_favorite_tracks (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.member_public_profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  artist_name text not null check (char_length(btrim(artist_name)) between 1 and 180),
  cover_source_url text check (cover_source_url is null or (char_length(btrim(cover_source_url)) between 1 and 1200 and cover_source_url ~ '^(https://|/)')),
  display_order smallint not null check (display_order between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, display_order)
);

create index if not exists profile_favorite_tracks_participant_order_idx on public.profile_favorite_tracks (participant_id, display_order);
alter table public.profile_favorite_tracks enable row level security;
revoke all on public.profile_favorite_tracks from anon, authenticated;
grant select on public.profile_favorite_tracks to anon, authenticated;
grant insert, update, delete on public.profile_favorite_tracks to authenticated;

create policy "Public favorite tracks are readable" on public.profile_favorite_tracks for select to anon, authenticated using (true);
create policy "Members manage their own favorite tracks" on public.profile_favorite_tracks for all to authenticated using (participant_id = (select auth.uid())) with check (participant_id = (select auth.uid()));
create policy "Administrators manage all favorite tracks" on public.profile_favorite_tracks for all to authenticated using ((select private.is_member_admin())) with check ((select private.is_member_admin()));

create or replace function private.enforce_profile_favorite_track()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and new.id <> old.id then raise exception 'A favorite track identifier cannot be changed'; end if;
  if (select auth.uid()) is not null and new.participant_id <> (select auth.uid()) and not private.is_member_admin() then raise exception 'A member can only manage their own favorite tracks'; end if;
  new.title := btrim(new.title);
  new.artist_name := btrim(new.artist_name);
  new.cover_source_url := nullif(btrim(coalesce(new.cover_source_url, '')), '');
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.enforce_profile_favorite_track() from public, anon, authenticated;

create trigger profile_favorite_tracks_validate before insert or update on public.profile_favorite_tracks for each row execute function private.enforce_profile_favorite_track();
