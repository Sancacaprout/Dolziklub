-- Existing member pages keep their historical presentation. A public theme is
-- only enabled after its owner explicitly applies it from their account page.
alter table public.member_public_profiles
  add column if not exists profile_theme_selected_at timestamptz;
