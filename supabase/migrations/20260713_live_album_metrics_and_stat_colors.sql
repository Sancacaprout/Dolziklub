-- Public, member-controlled colors for the three personal statistic cards.
alter table public.member_public_profiles
  add column if not exists stat_colors jsonb not null default '{"proposals":"#CCF51D","listens":"#CCF51D","given_average":"#CCF51D"}'::jsonb;

alter table public.member_public_profiles
  drop constraint if exists member_public_profiles_stat_colors_check;

alter table public.member_public_profiles
  add constraint member_public_profiles_stat_colors_check check (
    jsonb_typeof(stat_colors) = 'object'
    and (stat_colors->>'proposals') ~ '^#[0-9A-Fa-f]{6}$'
    and (stat_colors->>'listens') ~ '^#[0-9A-Fa-f]{6}$'
    and (stat_colors->>'given_average') ~ '^#[0-9A-Fa-f]{6}$'
  );

-- Aggregates expose only public totals, never a member's private review text.
create or replace function public.get_public_club_draw_metrics()
returns table (album_count bigint, review_count bigint, rating_sum numeric)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    count(*) filter (where entry.album_title is not null and entry.album_artist is not null),
    count(review.id),
    coalesce(sum(review.rating), 0)
  from public.club_draw_entries as entry
  left join public.member_album_reviews as review on review.album_id = entry.id::text;
$$;

create or replace function public.get_public_member_draw_metrics(p_username text)
returns table (
  proposed_count bigint,
  listened_count bigint,
  given_count bigint,
  given_sum numeric,
  received_count bigint,
  received_sum numeric
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    count(*) filter (where entry.proposed_by_name = lower(btrim(p_username)) and entry.album_title is not null and entry.album_artist is not null),
    count(*) filter (where entry.listened_by_name = lower(btrim(p_username)) and entry.album_title is not null and entry.album_artist is not null),
    count(review.id) filter (where entry.listened_by_name = lower(btrim(p_username))),
    coalesce(sum(review.rating) filter (where entry.listened_by_name = lower(btrim(p_username))), 0),
    count(review.id) filter (where entry.proposed_by_name = lower(btrim(p_username))),
    coalesce(sum(review.rating) filter (where entry.proposed_by_name = lower(btrim(p_username))), 0)
  from public.club_draw_entries as entry
  left join public.member_album_reviews as review on review.album_id = entry.id::text;
$$;

revoke all on function public.get_public_club_draw_metrics() from public;
revoke all on function public.get_public_member_draw_metrics(text) from public;
grant execute on function public.get_public_club_draw_metrics() to anon, authenticated;
grant execute on function public.get_public_member_draw_metrics(text) to anon, authenticated;
