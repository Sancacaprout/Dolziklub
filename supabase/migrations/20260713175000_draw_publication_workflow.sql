-- A draw has an explicit lifecycle. Only the newest published draw remains
-- editable; publishing a successor locks it permanently.
create table if not exists public.club_draws (
  draw_number integer primary key check (draw_number >= 1),
  participant_usernames text[] not null check (cardinality(participant_usernames) >= 2),
  status text not null default 'draft' check (status in ('draft', 'published', 'locked')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  locked_at timestamptz
);

with draw_members as (
  select
    entry.draw_number,
    coalesce(
      array_agg(distinct lower(name) order by lower(name)) filter (where name is not null),
      array[]::text[]
    ) as participant_usernames
  from public.club_draw_entries as entry
  cross join lateral unnest(array[entry.proposed_by_name, entry.listened_by_name]) as name
  group by entry.draw_number
), latest_existing_draw as (
  select max(draw_number) as draw_number from draw_members
)
insert into public.club_draws (draw_number, participant_usernames, status, published_at, locked_at)
select
  draw_members.draw_number,
  draw_members.participant_usernames,
  case when draw_members.draw_number = latest_existing_draw.draw_number then 'published' else 'locked' end,
  now(),
  case when draw_members.draw_number = latest_existing_draw.draw_number then null else now() end
from draw_members
cross join latest_existing_draw
where cardinality(draw_members.participant_usernames) >= 2
on conflict (draw_number) do nothing;

alter table public.club_draws enable row level security;
revoke all on table public.club_draws from anon, authenticated;
grant select on table public.club_draws to anon, authenticated;
create policy "Club draws are publicly readable"
  on public.club_draws for select to anon, authenticated using (true);

drop policy if exists "Proposers can complete their own draw slots" on public.club_draw_entries;
create policy "Proposers can complete only the current published draw"
  on public.club_draw_entries for update to authenticated
  using (
    (select auth.uid()) = proposed_by
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
  with check ((select auth.uid()) = proposed_by);

create or replace function private.enforce_assigned_draw_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.club_draw_entries as entry
    join public.club_draws as draw on draw.draw_number = entry.draw_number
    where entry.id::text = new.album_id
      and entry.listened_by = new.member_id
      and entry.album_title is not null
      and entry.album_artist is not null
      and draw.status = 'published'
      and not exists (
        select 1 from public.club_draws as newer
        where newer.status = 'published' and newer.draw_number > draw.draw_number
      )
  ) then
    raise exception 'Only the assigned listener of the current published draw can submit a review';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_assigned_draw_review() from public, anon, authenticated;

drop function if exists public.admin_create_club_draw(integer);
create function public.admin_create_club_draw(p_participant_usernames text[])
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
  insert into public.club_draws (draw_number, participant_usernames, status)
  values (next_draw, normalized_usernames, 'draft');
  insert into public.club_draw_entries (draw_number, position)
  select next_draw, series from generate_series(1, cardinality(normalized_usernames)) as series;
  return next_draw;
end;
$$;

drop function if exists public.admin_update_club_draw_entry(uuid, text, text);
create function public.admin_update_club_draw_entry(
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

create or replace function public.admin_publish_club_draw(p_draw_number integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  draw public.club_draws%rowtype;
  row_count integer;
  proposer_count integer;
  listener_count integer;
begin
  perform private.require_draw_admin();
  select * into draw from public.club_draws where draw_number = p_draw_number;
  if not found or draw.status = 'locked' then raise exception 'This draw is locked'; end if;
  select count(*), count(distinct proposed_by), count(distinct listened_by)
    into row_count, proposer_count, listener_count
  from public.club_draw_entries
  where draw_number = p_draw_number and proposed_by is not null and listened_by is not null;
  if row_count <> cardinality(draw.participant_usernames) or proposer_count <> row_count or listener_count <> row_count then
    raise exception 'Every participant must appear exactly once as proposer and listener before publication';
  end if;
  update public.club_draws set status = 'locked', locked_at = now() where status = 'published' and draw_number <> p_draw_number;
  update public.club_draws set status = 'published', published_at = now(), locked_at = null where draw_number = p_draw_number;
end;
$$;

create or replace function public.admin_delete_club_draw(p_draw_number integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.require_draw_admin();
  if exists (select 1 from public.club_draws where draw_number = p_draw_number and status = 'locked') then raise exception 'Locked draws cannot be deleted'; end if;
  delete from public.member_album_reviews where album_id in (select id::text from public.club_draw_entries where draw_number = p_draw_number);
  delete from public.club_draw_entries where draw_number = p_draw_number;
  delete from public.club_draws where draw_number = p_draw_number;
end;
$$;

revoke all on function public.admin_create_club_draw(text[]) from public, anon;
revoke all on function public.admin_update_club_draw_entry(uuid, text, text, boolean) from public, anon;
revoke all on function public.admin_publish_club_draw(integer) from public, anon;
revoke all on function public.admin_delete_club_draw(integer) from public, anon;
grant execute on function public.admin_create_club_draw(text[]) to authenticated;
grant execute on function public.admin_update_club_draw_entry(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_publish_club_draw(integer) to authenticated;
grant execute on function public.admin_delete_club_draw(integer) to authenticated;
