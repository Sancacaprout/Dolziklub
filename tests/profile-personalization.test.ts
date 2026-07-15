import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultProfileTheme, isProfileThemeId, profileThemeIds, profileThemes } from "../src/lib/profile-themes";

const migration = readFileSync(new URL("../supabase/migrations/20260714150000_profile_themes_and_favorite_albums.sql", import.meta.url), "utf8");

test("the profile theme catalogue contains the club default and ten visual themes", () => {
  assert.equal(profileThemes.length, 11);
  assert.equal(new Set(profileThemeIds).size, 11);
  assert.equal(defaultProfileTheme, "dol-ziklub");
  assert.equal(isProfileThemeId("dol-ziklub"), true);
  assert.equal(isProfileThemeId("dark-vinyl"), true);
  assert.equal(isProfileThemeId("unknown-theme"), false);
});

test("the migration validates themes and limits favorites to three display slots", () => {
  assert.match(migration, /member_public_profiles_profile_theme_check/);
  assert.match(migration, /'archive', 'dark-vinyl', 'fanzine', 'neon-club', 'natural-tape'/);
  assert.match(migration, /display_order smallint not null check \(display_order between 1 and 3\)/);
  assert.match(migration, /unique\(participant_id, display_order\)/);
  assert.match(migration, /source_album_id uuid references public\.club_draw_entries\(id\) on delete set null/);
});

test("the migration keeps profile themes, favorites and cover uploads behind RLS", () => {
  assert.match(migration, /alter table public\.profile_favorite_albums enable row level security/);
  assert.match(migration, /Members manage their own favorite albums/);
  assert.match(migration, /Administrators manage all favorite albums/);
  assert.match(migration, /Administrators update public member cards/);
  assert.match(migration, /Members upload their favorite covers/);
  assert.match(migration, /profile_theme_updated/);
  assert.match(migration, /favorite_album_removed/);
});
