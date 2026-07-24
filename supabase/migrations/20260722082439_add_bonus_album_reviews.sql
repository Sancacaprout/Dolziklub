-- A personal bonus review lets a club member revisit an album that was
-- officially reviewed by another listener. It never replaces that verdict.
create table public.bonus_album_reviews (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.club_draw_entries(id) on delete cascade,
  member_id uuid not null references public.member_profiles(id) on delete cascade,
  review_title text,
  review text not null,
  rating numeric not null,
  best_track text,
  worst_track text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bonus_album_reviews_entry_member_unique unique (entry_id, member_id),
  constraint bonus_album_reviews_rating_half_step_check
    check (rating >= 0 and rating <= 5 and rating * 2 = trunc(rating * 2)),
  constraint bonus_album_reviews_review_check check (char_length(btrim(review)) between 1 and 2000),
  constraint bonus_album_reviews_title_check check (review_title is null or char_length(btrim(review_title)) <= 160),
  constraint bonus_album_reviews_track_check check (
    (best_track is null or char_length(btrim(best_track)) <= 160)
    and (worst_track is null or char_length(btrim(worst_track)) <= 160)
  )
);

create index bonus_album_reviews_member_updated_idx
  on public.bonus_album_reviews (member_id, updated_at desc);

alter table public.bonus_album_reviews enable row level security;

create policy "Members read their own bonus reviews"
  on public.bonus_album_reviews for select to authenticated
  using ((select auth.uid()) = member_id);

create or replace function private.touch_bonus_album_review()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_bonus_album_review() from public, anon, authenticated;

drop trigger if exists bonus_album_reviews_touch_updated_at on public.bonus_album_reviews;
create trigger bonus_album_reviews_touch_updated_at
  before update on public.bonus_album_reviews
  for each row execute function private.touch_bonus_album_review();

create or replace function public.save_my_bonus_album_review(
  p_entry_id uuid,
  p_review_title text,
  p_review text,
  p_rating numeric,
  p_best_track text,
  p_worst_track text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_member_id uuid := (select auth.uid());
  saved_review_id uuid;
begin
  if current_member_id is null then
    raise exception 'Authentication required';
  end if;
  if p_review is null or char_length(btrim(p_review)) = 0 then
    raise exception 'A review is required';
  end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 or p_rating * 2 <> trunc(p_rating * 2) then
    raise exception 'Rating must be between 0 and 5 in half steps';
  end if;

  if not exists (
    select 1
    from public.member_profiles as profile
    where profile.id = current_member_id
  ) then
    raise exception 'Member profile not found';
  end if;

  if not exists (
    select 1
    from public.club_draw_entries as entry
    join public.member_album_reviews as official_review
      on official_review.album_id = entry.id::text
     and official_review.rating is not null
    where entry.id = p_entry_id
      and entry.listened_by is distinct from current_member_id
      and nullif(btrim(entry.album_title), '') is not null
      and nullif(btrim(entry.album_artist), '') is not null
  ) then
    raise exception 'Choose an album officially reviewed by another member';
  end if;

  insert into public.bonus_album_reviews (
    entry_id, member_id, review_title, review, rating, best_track, worst_track
  ) values (
    p_entry_id,
    current_member_id,
    nullif(btrim(p_review_title), ''),
    btrim(p_review),
    p_rating,
    nullif(btrim(p_best_track), ''),
    nullif(btrim(p_worst_track), '')
  )
  on conflict (entry_id, member_id) do update
  set review_title = excluded.review_title,
      review = excluded.review,
      rating = excluded.rating,
      best_track = excluded.best_track,
      worst_track = excluded.worst_track
  returning id into saved_review_id;

  return saved_review_id;
end;
$$;

create or replace function public.reset_my_bonus_album_review(p_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_member_id uuid := (select auth.uid());
  deleted_review_id uuid;
begin
  if current_member_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.bonus_album_reviews
  where entry_id = p_entry_id
    and member_id = current_member_id
  returning id into deleted_review_id;

  if deleted_review_id is null then
    raise exception 'No bonus review exists for this album';
  end if;

  return deleted_review_id;
end;
$$;

revoke all on function public.save_my_bonus_album_review(uuid, text, text, numeric, text, text) from public, anon;
revoke all on function public.reset_my_bonus_album_review(uuid) from public, anon;
grant execute on function public.save_my_bonus_album_review(uuid, text, text, numeric, text, text) to authenticated;
grant execute on function public.reset_my_bonus_album_review(uuid) to authenticated;
