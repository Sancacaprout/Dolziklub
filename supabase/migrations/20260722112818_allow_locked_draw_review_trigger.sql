-- A verdict remains owned by its assigned listener after the following draw starts.
-- Locked draws are historical, but their unanswered entries must stay reviewable.
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
      and nullif(btrim(entry.album_title), '') is not null
      and nullif(btrim(entry.album_artist), '') is not null
      and draw.status in ('published', 'locked')
  ) then
    raise exception 'Only the assigned listener can submit a review for this draw';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_assigned_draw_review() from public, anon, authenticated;