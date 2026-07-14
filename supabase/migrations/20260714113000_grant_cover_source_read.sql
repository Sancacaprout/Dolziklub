-- A selected YouTube Music thumbnail is public media, displayed with each public draw row.
grant select (cover_source_url)
  on public.club_draw_entries to anon, authenticated;
