drop policy if exists "Members read their own bonus reviews" on public.bonus_album_reviews;

create policy "Members read club bonus reviews"
  on public.bonus_album_reviews for select to authenticated
  using (true);
