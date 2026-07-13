-- A proposer owns their album slot only until the assigned listener records a verdict.
drop policy if exists "Proposers can complete only the current published draw" on public.club_draw_entries;
create policy "Proposers can edit only an unanswered current draw slot"
  on public.club_draw_entries for update to authenticated
  using (
    (select auth.uid()) = proposed_by
    and not exists (
      select 1 from public.member_album_reviews as review
      where review.album_id = club_draw_entries.id::text
    )
    and exists (
      select 1 from public.club_draws as draw
      where draw.draw_number = club_draw_entries.draw_number
        and draw.status = 'published'
        and not exists (
          select 1 from public.club_draws as newer
          where newer.status = 'published' and newer.draw_number > draw.draw_number
        )
    )
  )
  with check (
    (select auth.uid()) = proposed_by
    and not exists (
      select 1 from public.member_album_reviews as review
      where review.album_id = club_draw_entries.id::text
    )
  );

create or replace function private.prevent_proposal_change_after_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.member_album_reviews
    where album_id = old.id::text
  ) then
    raise exception 'A proposal cannot be changed after its review has been submitted';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_proposal_change_after_review() from public, anon, authenticated;
drop trigger if exists club_draw_entries_lock_reviewed_proposals on public.club_draw_entries;
create trigger club_draw_entries_lock_reviewed_proposals
  before update of album_title, album_artist, cover_path on public.club_draw_entries
  for each row execute function private.prevent_proposal_change_after_review();
