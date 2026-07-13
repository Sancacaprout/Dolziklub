-- Administrators can prevent a proposer/listener duo from recurring in later draws.
alter table public.club_draws
  add column if not exists avoid_repeated_pairs boolean not null default true;

drop function if exists public.admin_create_club_draw(text[]);
create function public.admin_create_club_draw(
  p_participant_usernames text[],
  p_avoid_repeated_pairs boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_usernames text[];
  next_draw integer;
begin
  perform private.require_draw_admin();
  select array_agg(distinct lower(btrim(username)) order by lower(btrim(username)))
    into normalized_usernames
  from unnest(p_participant_usernames) as username
  where nullif(btrim(username), '') is not null;

  if cardinality(normalized_usernames) < 2 then
    raise exception 'At least two participants are required';
  end if;
  if cardinality(normalized_usernames) <> cardinality(p_participant_usernames) then
    raise exception 'Each participant must be selected only once';
  end if;
  if (select count(*) from public.member_profiles where lower(username) = any(normalized_usernames)) <> cardinality(normalized_usernames) then
    raise exception 'Unknown participant';
  end if;

  select greatest(coalesce(max(draw_number), 0), 6) + 1 into next_draw from public.club_draws;
  insert into public.club_draws (draw_number, participant_usernames, status, avoid_repeated_pairs)
  values (next_draw, normalized_usernames, 'draft', coalesce(p_avoid_repeated_pairs, true));
  insert into public.club_draw_entries (draw_number, position)
  select next_draw, series from generate_series(1, cardinality(normalized_usernames)) as series;
  return next_draw;
end;
$$;

create or replace function public.admin_update_club_draw_entry(
  p_entry_id uuid,
  p_proposer_username text,
  p_listener_username text,
  p_confirm_reset boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entry public.club_draw_entries%rowtype;
  draw public.club_draws%rowtype;
  proposer public.member_profiles%rowtype;
  listener public.member_profiles%rowtype;
  has_content boolean;
  assignment_changed boolean;
begin
  perform private.require_draw_admin();
  select * into entry from public.club_draw_entries where id = p_entry_id;
  if not found then raise exception 'Unknown draw slot'; end if;
  select * into draw from public.club_draws where draw_number = entry.draw_number;
  if not found or draw.status = 'locked' then raise exception 'This draw is locked'; end if;

  if nullif(btrim(p_proposer_username), '') is not null then
    select * into proposer from public.member_profiles where lower(username) = lower(btrim(p_proposer_username));
    if proposer.id is null or not (proposer.username = any(draw.participant_usernames)) then raise exception 'Invalid proposer'; end if;
  end if;
  if nullif(btrim(p_listener_username), '') is not null then
    select * into listener from public.member_profiles where lower(username) = lower(btrim(p_listener_username));
    if listener.id is null or not (listener.username = any(draw.participant_usernames)) then raise exception 'Invalid listener'; end if;
  end if;
  if proposer.id is not null and exists (select 1 from public.club_draw_entries where draw_number = entry.draw_number and id <> entry.id and proposed_by = proposer.id) then raise exception 'A proposer can only appear once per draw'; end if;
  if listener.id is not null and exists (select 1 from public.club_draw_entries where draw_number = entry.draw_number and id <> entry.id and listened_by = listener.id) then raise exception 'A listener can only appear once per draw'; end if;
  if draw.avoid_repeated_pairs and proposer.id is not null and listener.id is not null and exists (
    select 1
    from public.club_draw_entries as earlier_entry
    join public.club_draws as earlier_draw on earlier_draw.draw_number = earlier_entry.draw_number
    where earlier_entry.draw_number <> entry.draw_number
      and earlier_draw.status in ('published', 'locked')
      and earlier_entry.proposed_by = proposer.id
      and earlier_entry.listened_by = listener.id
  ) then
    raise exception 'This proposer/listener duo already appeared in an earlier draw';
  end if;

  assignment_changed := entry.proposed_by is distinct from proposer.id or entry.listened_by is distinct from listener.id;
  has_content := entry.album_title is not null or entry.album_artist is not null or exists (select 1 from public.member_album_reviews where album_id = entry.id::text);
  if assignment_changed and has_content and not p_confirm_reset then
    raise exception 'Confirmation required: this change will clear the album and its review';
  end if;
  if assignment_changed and has_content then
    delete from public.member_album_reviews where album_id = entry.id::text;
  end if;
  update public.club_draw_entries
     set proposed_by = proposer.id,
         listened_by = listener.id,
         proposed_by_name = proposer.username,
         listened_by_name = listener.username,
         album_title = case when assignment_changed and has_content then null else album_title end,
         album_artist = case when assignment_changed and has_content then null else album_artist end,
         cover_path = case when assignment_changed and has_content then null else cover_path end
   where id = entry.id;
end;
$$;

revoke all on function public.admin_create_club_draw(text[], boolean) from public, anon;
grant execute on function public.admin_create_club_draw(text[], boolean) to authenticated;
