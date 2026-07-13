-- A remote meme uses the public id "upload-<meme_posts.id>" for its social data.
-- Clean that related data in the database when its author removes the post.
create or replace function private.cleanup_deleted_meme_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.meme_comments
  where meme_id = 'upload-' || old.id::text;

  delete from public.meme_reactions
  where meme_id = 'upload-' || old.id::text;

  delete from public.meme_guest_reactions
  where meme_id = 'upload-' || old.id::text;

  return old;
end;
$$;

revoke all on function private.cleanup_deleted_meme_post() from public, anon, authenticated;

drop trigger if exists cleanup_deleted_meme_post on public.meme_posts;
create trigger cleanup_deleted_meme_post
  after delete on public.meme_posts
  for each row execute function private.cleanup_deleted_meme_post();
