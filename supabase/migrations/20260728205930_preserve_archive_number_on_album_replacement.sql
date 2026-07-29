-- Repair the one production slot that lost archive 71 when its album was
-- temporarily cleared, then close the secondary gap without changing archive 72.
do $$
begin
  if not exists (
    select 1 from public.club_draw_entries where archive_number = 71
  ) and exists (
    select 1
    from public.club_draw_entries
    where id = '5c755f22-2ef6-427f-92e5-17c9d5da3409'::uuid
      and archive_number = 73
  ) then
    update public.club_draw_entries
    set archive_number = -archive_number
    where archive_number > 73;

    update public.club_draw_entries
    set archive_number = 71
    where id = '5c755f22-2ef6-427f-92e5-17c9d5da3409'::uuid
      and archive_number = 73;

    update public.club_draw_entries
    set archive_number = (-archive_number) - 1
    where archive_number < -73;
  end if;
end;
$$;

create or replace function private.assign_club_draw_archive_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Once a slot owns an archive number, clearing or replacing its album must
  -- never release that number.
  if tg_op = 'UPDATE' and old.archive_number is not null then
    new.archive_number := old.archive_number;
  elsif nullif(btrim(new.album_title), '') is null
     or nullif(btrim(new.album_artist), '') is null then
    new.archive_number := null;
  elsif new.archive_number is null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('club_draw_entries_archive_number', 0)
    );

    select greatest(coalesce(max(entry.archive_number), 49), 49) + 1
      into new.archive_number
    from public.club_draw_entries as entry;
  end if;

  return new;
end;
$$;

revoke all on function private.assign_club_draw_archive_number()
  from public, anon, authenticated;

drop trigger if exists club_draw_entries_assign_archive_number
  on public.club_draw_entries;
create trigger club_draw_entries_assign_archive_number
  before insert or update of album_title, album_artist, archive_number
  on public.club_draw_entries
  for each row execute function private.assign_club_draw_archive_number();

update public.site_updates
set content = jsonb_set(
      content,
      '{fixed}',
      coalesce(content -> 'fixed', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'text',
            'Remplacer un album conserve désormais son numéro d’archive, même si la proposition est retirée puis recréée.'
          )
        ),
      true
    ),
    updated_at = now()
where id = 'extra-listening-requests'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(content -> 'fixed', '[]'::jsonb)) as item
    where item ->> 'text' = 'Remplacer un album conserve désormais son numéro d’archive, même si la proposition est retirée puis recréée.'
  );
