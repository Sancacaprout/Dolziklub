-- Archives 1 to 6 predate the editable draw table. Never restart numbering at 1.
create or replace function public.admin_create_club_draw(p_entry_count integer default 8)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_draw integer;
begin
  perform private.require_draw_admin();
  if p_entry_count < 1 or p_entry_count > 20 then
    raise exception 'A draw must contain between 1 and 20 slots';
  end if;

  select greatest(coalesce(max(draw_number), 0), 6) + 1
    into next_draw
    from public.club_draw_entries;

  insert into public.club_draw_entries (draw_number, position)
  select next_draw, series
  from generate_series(1, p_entry_count) as series;
  return next_draw;
end;
$$;
