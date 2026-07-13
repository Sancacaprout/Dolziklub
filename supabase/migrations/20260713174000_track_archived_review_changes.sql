alter table public.archived_album_reviews
  add column if not exists is_modified boolean not null default false;

create or replace function private.touch_archived_album_review()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.is_modified := true;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_archived_album_review() from public, anon, authenticated;
