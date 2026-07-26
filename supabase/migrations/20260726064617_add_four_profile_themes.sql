-- Extends the profile theme catalogue without changing profile data or RLS policies.
alter table public.member_public_profiles
  drop constraint if exists member_public_profiles_profile_theme_check;

alter table public.member_public_profiles
  add constraint member_public_profiles_profile_theme_check check (
    profile_theme in (
      'dol-ziklub',
      'archive', 'dark-vinyl', 'fanzine', 'neon-club', 'natural-tape',
      'chrome-2000', 'city-pop', 'punk-poster', 'jazz-lounge', 'acid-rave',
      'wheely', 'noir-cinema', 'manga-panel', 'cassette-sunset', 'museum-white'
    )
  );
