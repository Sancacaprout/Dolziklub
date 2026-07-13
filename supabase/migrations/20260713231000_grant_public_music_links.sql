-- These fields are safe public destinations, shown only alongside public draw rows.
-- Internal YouTube identifiers and metadata remain unavailable to anonymous clients.
grant select (youtube_music_url, music_metadata_verified, music_resource_type)
  on public.club_draw_entries to anon, authenticated;
