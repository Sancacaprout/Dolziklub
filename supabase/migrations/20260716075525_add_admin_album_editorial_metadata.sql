create table public.album_editorial_metadata (
  draw_entry_id uuid primary key
    references public.club_draw_entries(id) on delete cascade,
  release_year smallint
    check (release_year is null or release_year between 1900 and 2100),
  origin text
    check (origin is null or char_length(btrim(origin)) between 1 and 120),
  language text
    check (language is null or char_length(btrim(language)) between 1 and 120),
  genres text[] not null default '{}'
    check (cardinality(genres) <= 12 and char_length(array_to_string(genres, '|')) <= 600),
  project_type text
    check (project_type is null or char_length(btrim(project_type)) between 1 and 120),
  artist_description text
    check (artist_description is null or char_length(btrim(artist_description)) between 1 and 5000),
  album_description text
    check (album_description is null or char_length(btrim(album_description)) between 1 and 5000),
  updated_by uuid not null default auth.uid()
    references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index album_editorial_metadata_updated_by_idx
  on public.album_editorial_metadata(updated_by);

alter table public.album_editorial_metadata enable row level security;

revoke all privileges on public.album_editorial_metadata from anon, authenticated;

grant select on public.album_editorial_metadata to anon, authenticated;
grant insert, update, delete on public.album_editorial_metadata to authenticated;

create policy "Album editorial metadata is publicly readable"
  on public.album_editorial_metadata for select
  to anon, authenticated
  using (true);

create policy "Administrators can add album editorial metadata"
  on public.album_editorial_metadata for insert
  to authenticated
  with check (
    (select private.is_member_admin())
    and (select auth.uid()) = updated_by
  );

create policy "Administrators can update album editorial metadata"
  on public.album_editorial_metadata for update
  to authenticated
  using ((select private.is_member_admin()))
  with check (
    (select private.is_member_admin())
    and (select auth.uid()) = updated_by
  );

create policy "Administrators can remove album editorial metadata"
  on public.album_editorial_metadata for delete
  to authenticated
  using ((select private.is_member_admin()));

create function private.touch_album_editorial_metadata()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce((select auth.uid()), old.updated_by);
  return new;
end;
$$;

create trigger album_editorial_metadata_touch_updated_at
before update on public.album_editorial_metadata
for each row execute function private.touch_album_editorial_metadata();