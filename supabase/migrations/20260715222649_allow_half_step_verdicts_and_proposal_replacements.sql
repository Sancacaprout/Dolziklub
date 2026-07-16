-- The UI offers half-star ratings, so the database must accept exactly the
-- same 0.5 increments while keeping the existing 0..5 range constraint.
alter table public.member_album_reviews
  drop constraint if exists member_album_reviews_integer_rating;

alter table public.member_album_reviews
  drop constraint if exists member_album_reviews_half_step_rating;

alter table public.member_album_reviews
  add constraint member_album_reviews_half_step_rating
  check (rating * 2 = trunc(rating * 2));

-- Replacing or removing a proposal is a supported action. The newer
-- club_draw_entries_reset_changed_proposal trigger deletes the obsolete review
-- and archive link after the entry changes, so the old blocking trigger and
-- its review-dependent RLS predicate must not prevent the update first.
drop trigger if exists club_draw_entries_lock_reviewed_proposals
  on public.club_draw_entries;
drop function if exists private.prevent_proposal_change_after_review();

drop policy if exists "Proposers can edit their unanswered published draw slot"
  on public.club_draw_entries;
drop policy if exists "Proposers can edit their published draw slot"
  on public.club_draw_entries;

create policy "Proposers can edit their published draw slot"
  on public.club_draw_entries for update to authenticated
  using (
    (select auth.uid()) = proposed_by
    and exists (
      select 1
      from public.club_draws draw
      where draw.draw_number = club_draw_entries.draw_number
        and draw.status in ('published', 'locked')
    )
  )
  with check (
    (select auth.uid()) = proposed_by
    and exists (
      select 1
      from public.club_draws draw
      where draw.draw_number = club_draw_entries.draw_number
        and draw.status in ('published', 'locked')
    )
  );
