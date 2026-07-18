-- Admin cover uploads use the administrator's JWT rather than a service role
-- key. This keeps the privileged key out of the deployment while preserving
-- RLS enforcement at both storage and database levels.
alter table public.album_cover_overrides
  drop constraint if exists album_cover_overrides_cover_path_check;

alter table public.album_cover_overrides
  add constraint album_cover_overrides_cover_path_check
  check (cover_path ~ '^[0-9a-f-]{36}/editorial/archive-[0-9]+/[0-9]{13}\.(jpg|png|webp)$');

drop policy if exists "Admins can upload editorial album covers" on storage.objects;
create policy "Admins can upload editorial album covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'album-covers'
    and name ~ '^[0-9a-f-]{36}/editorial/(archive-[0-9]+|[0-9a-f-]{36})/[0-9]{13}\.(jpg|png|webp)$'
    and (select private.is_member_admin())
  );

create or replace function public.admin_set_club_draw_cover(
  p_entry_id uuid,
  p_cover_path text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_draw_admin();

  if p_cover_path !~ '^[0-9a-f-]{36}/editorial/[0-9a-f-]{36}/[0-9]{13}\.(jpg|png|webp)$' then
    raise exception 'Invalid album cover path';
  end if;

  update public.club_draw_entries
     set cover_path = p_cover_path,
         cover_source_url = null
   where id = p_entry_id;

  if not found then
    raise exception 'Unknown draw slot';
  end if;
end;
$$;

revoke all on function public.admin_set_club_draw_cover(uuid, text) from public, anon;
grant execute on function public.admin_set_club_draw_cover(uuid, text) to authenticated;
