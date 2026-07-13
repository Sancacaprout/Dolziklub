-- Public URLs can serve covers without granting bucket-wide object listing.
drop policy if exists "Album covers are public" on storage.objects;

create policy "Proposers can replace their album cover"
  on storage.objects for update to authenticated
  using (bucket_id = 'album-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'album-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
