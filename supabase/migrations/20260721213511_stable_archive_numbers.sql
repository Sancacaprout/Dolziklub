-- A catalogue number is allocated once when an album is first put in a draw.
-- Existing static archives 1..49 are unchanged; the recent draw continues at 50.
alter table public.club_draw_entries
  add column if not exists archive_number integer;

create unique index if not exists club_draw_entries_archive_number_unique
  on public.club_draw_entries (archive_number)
  where archive_number is not null;

update public.club_draw_entries as entry
set archive_number = numbered.archive_number
from (values
  ('e6d0888c-e1f9-454a-83d9-734e799a8606'::uuid, 46),
  ('6a384c88-24ce-4924-906f-9e361efb207b'::uuid, 47),
  ('db4da781-9d1f-4f2d-b7a7-5ca153883489'::uuid, 48),
  ('90ea6759-0b2a-4bc2-90e3-96bccf73bd29'::uuid, 49),
  ('8594a435-820d-4c8b-88dc-34de47747062'::uuid, 50),
  ('b408bd5d-27f4-45e6-827a-6b3816d32312'::uuid, 51),
  ('9ea6c113-5687-4dd7-8eef-150252b756ed'::uuid, 52),
  ('d98caa7b-0363-4f45-abfe-59f253283a6f'::uuid, 53),
  ('79016df7-ebe4-4aff-a67c-220f6ba6fb02'::uuid, 54),
  ('3982fd84-dc2d-477d-9b76-6bb83c52e50a'::uuid, 55),
  ('4c73abac-d18f-4a1d-b119-b2a021965e3f'::uuid, 56),
  ('cea00e39-73d6-4670-8619-7432906bcc4f'::uuid, 57),
  ('ddebc411-d5e5-4c69-87a6-dd7f36cbc0d2'::uuid, 58),
  ('d57d322d-c612-496b-9d11-de744238b0bd'::uuid, 59),
  ('af549b87-de0e-49f8-8d3e-ea706676b622'::uuid, 60),
  ('4aa756e9-12de-4fb1-850f-b2545dfdc161'::uuid, 61),
  ('dc97a74f-4343-4c4c-abc4-c49f16c94cbb'::uuid, 62),
  ('fe704b4f-a58b-4006-a55f-27e4042843dc'::uuid, 63)
) as numbered(id, archive_number)
where entry.id = numbered.id;

create or replace function private.assign_club_draw_archive_number()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(new.album_title), '') is null or nullif(btrim(new.album_artist), '') is null then
    new.archive_number := null;
  elsif new.archive_number is null then
    select greatest(coalesce(max(archive_number), 49), 49) + 1
      into new.archive_number
    from public.club_draw_entries;
  end if;
  return new;
end;
$$;

revoke all on function private.assign_club_draw_archive_number() from public, anon, authenticated;
drop trigger if exists club_draw_entries_assign_archive_number on public.club_draw_entries;
create trigger club_draw_entries_assign_archive_number
  before insert or update of album_title, album_artist
  on public.club_draw_entries
  for each row execute function private.assign_club_draw_archive_number();