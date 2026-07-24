-- Published draw rows are intentionally visible in the public tableur.
-- RLS remains enabled and the existing select policy controls row visibility.
grant select on table public.club_draw_entries to anon, authenticated;
