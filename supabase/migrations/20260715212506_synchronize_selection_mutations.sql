-- Keep a draw entry and its linked archive card consistent when the proposer
-- replaces or removes the album. The review is removed first so the existing
-- review trigger can clear the previous archive card before its private link
-- disappears.
create or replace function private.reset_draw_entry_state_on_proposal_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.album_title is not distinct from new.album_title
    and old.album_artist is not distinct from new.album_artist then
    return new;
  end if;

  delete from public.member_album_reviews
  where album_id = new.id::text;

  delete from private.club_draw_archive_links
  where entry_id = new.id;

  return new;
end;
$$;

revoke all on function private.reset_draw_entry_state_on_proposal_change()
  from public, anon, authenticated;

drop trigger if exists club_draw_entries_reset_changed_proposal on public.club_draw_entries;
create trigger club_draw_entries_reset_changed_proposal
  after update of album_title, album_artist on public.club_draw_entries
  for each row
  execute function private.reset_draw_entry_state_on_proposal_change();
