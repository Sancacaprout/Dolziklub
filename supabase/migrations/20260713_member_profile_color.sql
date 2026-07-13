-- Public profile background color. The check keeps the browser-supplied value
-- safe to use as a CSS color while the existing RLS policy limits edits to the
-- profile owner.

alter table public.member_public_profiles
  add column if not exists profile_color text not null default '#c8ff00'
  check (profile_color ~ '^#[0-9A-Fa-f]{6}$');
