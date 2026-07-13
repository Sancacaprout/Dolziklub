-- A participant can only propose for their own slot and review an album they
-- were assigned to listen to. Pending entries remain actionable after a newer
-- draw exists, so no outstanding verdict gets stranded.
drop policy if exists "Proposers can edit only an unanswered current draw slot" on public.club_draw_entries;
create policy "Proposers can edit their unanswered published draw slot"
  on public.club_draw_entries for update to authenticated
  using (
    (select auth.uid()) = proposed_by
    and not exists (
      select 1 from public.member_album_reviews review
      where review.album_id = club_draw_entries.id::text
    )
    and exists (
      select 1 from public.club_draws draw
      where draw.draw_number = club_draw_entries.draw_number
        and draw.status in ('published', 'locked')
    )
  )
  with check (
    (select auth.uid()) = proposed_by
    and not exists (
      select 1 from public.member_album_reviews review
      where review.album_id = club_draw_entries.id::text
    )
    and exists (
      select 1 from public.club_draws draw
      where draw.draw_number = club_draw_entries.draw_number
        and draw.status in ('published', 'locked')
    )
  );

drop policy if exists "Members can add their own album reviews" on public.member_album_reviews;
create policy "Assigned listeners can add their own album reviews"
  on public.member_album_reviews for insert to authenticated
  with check (
    (select auth.uid()) = member_id
    and exists (
      select 1
      from public.club_draw_entries entry
      join public.club_draws draw on draw.draw_number = entry.draw_number
      where entry.id::text = member_album_reviews.album_id
        and entry.listened_by = (select auth.uid())
        and draw.status in ('published', 'locked')
    )
  );

drop policy if exists "Members can update their own album reviews" on public.member_album_reviews;
create policy "Assigned listeners can update their own album reviews"
  on public.member_album_reviews for update to authenticated
  using (
    (select auth.uid()) = member_id
    and exists (
      select 1 from public.club_draw_entries entry
      where entry.id::text = member_album_reviews.album_id
        and entry.listened_by = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = member_id
    and exists (
      select 1 from public.club_draw_entries entry
      where entry.id::text = member_album_reviews.album_id
        and entry.listened_by = (select auth.uid())
    )
  );
