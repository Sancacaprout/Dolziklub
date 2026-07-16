revoke all privileges on public.album_editorial_metadata from anon, authenticated;

grant select on public.album_editorial_metadata to anon, authenticated;
grant insert, update, delete on public.album_editorial_metadata to authenticated;