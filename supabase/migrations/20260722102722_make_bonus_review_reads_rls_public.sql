-- Bonus reviews are intended for the club tableur, just like official verdicts.
-- Keep RLS enabled and make the read rule explicit instead of bypassing it.
grant select on table public.bonus_album_reviews to anon, authenticated;

drop policy if exists "Members read club bonus reviews" on public.bonus_album_reviews;
drop policy if exists "Public read club bonus reviews" on public.bonus_album_reviews;
create policy "Public read club bonus reviews"
  on public.bonus_album_reviews for select
  to anon, authenticated
  using (true);

alter function public.get_public_bonus_draw_reviews() security invoker;
