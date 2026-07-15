-- The club's native visual identity is a selectable profile theme as well as
-- the database default for newly created member cards.
alter table public.member_public_profiles
  drop constraint if exists member_public_profiles_profile_theme_check;

alter table public.member_public_profiles
  add constraint member_public_profiles_profile_theme_check check (
    profile_theme in (
      'dol-ziklub',
      'archive', 'dark-vinyl', 'fanzine', 'neon-club', 'natural-tape',
      'chrome-2000', 'city-pop', 'punk-poster', 'jazz-lounge', 'acid-rave'
    )
  );

alter table public.member_public_profiles
  alter column profile_theme set default 'dol-ziklub';
