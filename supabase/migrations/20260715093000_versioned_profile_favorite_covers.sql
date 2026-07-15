-- Allow a new immutable cover path on every replacement. Keeping the UUID
-- folders preserves ownership checks while avoiding stale CDN/browser content.
alter table public.profile_favorite_albums
  drop constraint if exists profile_favorite_albums_cover_path_check;

alter table public.profile_favorite_albums
  add constraint profile_favorite_albums_cover_path_check check (
    cover_path is null
    or cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover(-[0-9]{10,16})?\.(jpg|png|webp)$'
  );

update storage.buckets
set file_size_limit = 5242880
where id = 'profile-favorites';

drop policy if exists "Members upload their favorite covers" on storage.objects;
drop policy if exists "Members read their favorite cover objects" on storage.objects;
drop policy if exists "Members update their favorite covers" on storage.objects;
drop policy if exists "Members remove their favorite covers" on storage.objects;

create policy "Members upload their favorite covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover(-[0-9]{10,16})?\.(jpg|png|webp)$'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_member_admin())
    )
  );

create policy "Members read their favorite cover objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover(-[0-9]{10,16})?\.(jpg|png|webp)$'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_member_admin())
    )
  );

create policy "Members update their favorite covers"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover(-[0-9]{10,16})?\.(jpg|png|webp)$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_member_admin()))
  )
  with check (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover(-[0-9]{10,16})?\.(jpg|png|webp)$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_member_admin()))
  );

create policy "Members remove their favorite covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-favorites'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cover(-[0-9]{10,16})?\.(jpg|png|webp)$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_member_admin()))
  );