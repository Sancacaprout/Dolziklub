-- A draw can never assign the same member as both proposer and listener.
alter table public.club_draw_entries
  drop constraint if exists club_draw_entries_no_self_assignment;

alter table public.club_draw_entries
  add constraint club_draw_entries_no_self_assignment
  check (proposed_by is null or listened_by is null or proposed_by <> listened_by);

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
  if proposer.id is not null and listener.id is not null and proposer.id = listener.id then
    raise exception 'A member cannot propose and listen to the same album';
  end if;
  if proposer.id is not null and exists (select 1 from public.club_draw_entries where draw_number = entry.draw_number and id <> entry.id and proposed_by = proposer.id) then raise exception 'A proposer can only appear once per draw'; end if;
  if listener.id is not null and exists (select 1 from public.club_draw_entries where draw_number = entry.draw_number and id <> entry.id and listened_by = listener.id) then raise exception 'A listener can only appear once per draw'; end if;
  if proposer.id is not null and listener.id is not null and exists (
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
  self_assignment_count integer;
begin
  perform private.require_draw_admin();
  select * into draw from public.club_draws where draw_number = p_draw_number;
  if not found or draw.status = 'locked' then raise exception 'This draw is locked'; end if;

  select count(*), count(distinct proposed_by), count(distinct listened_by), count(*) filter (where proposed_by = listened_by)
    into row_count, proposer_count, listener_count, self_assignment_count
  from public.club_draw_entries
  where draw_number = p_draw_number and proposed_by is not null and listened_by is not null;
  if row_count <> cardinality(draw.participant_usernames) or proposer_count <> row_count or listener_count <> row_count or self_assignment_count > 0 then
    raise exception 'Every participant must appear exactly once, without listening to their own proposal, before publication';
  end if;

  update public.club_draws set status = 'locked', locked_at = now() where status = 'published' and draw_number <> p_draw_number;
  update public.club_draws set status = 'published', published_at = now(), locked_at = null where draw_number = p_draw_number;
end;
$$;

revoke all on function public.admin_update_club_draw_entry(uuid, text, text, boolean) from public, anon;
revoke all on function public.admin_publish_club_draw(integer) from public, anon;
grant execute on function public.admin_update_club_draw_entry(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_publish_club_draw(integer) to authenticated;
