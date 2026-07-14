-- An assigned listener may reset only their own verdict for a live draw entry.
-- Removing the review also cascades to its associated best/worst track rows.
drop policy if exists "Assigned listeners can delete their own album reviews" on public.member_album_reviews;
create policy "Assigned listeners can delete their own album reviews"
  on public.member_album_reviews for delete to authenticated
  using (
    (select auth.uid()) = member_id
    and exists (
      select 1
      from public.club_draw_entries entry
      where entry.id::text = member_album_reviews.album_id
        and entry.listened_by = (select auth.uid())
    )
  );
