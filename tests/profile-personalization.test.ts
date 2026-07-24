import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultProfileTheme, isProfileThemeId, profileThemeIds, profileThemes } from "../src/lib/profile-themes";

const migration = readFileSync(new URL("../supabase/migrations/20260714150000_profile_themes_and_favorite_albums.sql", import.meta.url), "utf8");const accountPanel = readFileSync(new URL("../src/components/auth/account-panel.tsx", import.meta.url), "utf8");
const themeEditor = readFileSync(new URL("../src/components/auth/profile-personalization.tsx", import.meta.url), "utf8");
const musicAssist = readFileSync(new URL("../src/components/music-assist.tsx", import.meta.url), "utf8");

test("the profile theme catalogue contains the club default and eleven visual themes", () => {
  assert.equal(profileThemes.length, 12);
  assert.equal(new Set(profileThemeIds).size, 12);
  assert.equal(defaultProfileTheme, "dol-ziklub");
  assert.equal(isProfileThemeId("dol-ziklub"), true);
  assert.equal(isProfileThemeId("dark-vinyl"), true);
  assert.equal(isProfileThemeId("wheely"), true);
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
test("avatar picker stays accessible without changing the Supabase upload contract", () => {
  assert.match(accountPanel, /Choisir une nouvelle photo/);
  assert.match(accountPanel, /className="visually-hidden"/);
  assert.match(accountPanel, /avatarFile\.name/);
  assert.match(accountPanel, /3 \* 1024 \* 1024/);
  assert.match(accountPanel, /storage\.from\("member-avatars"\)/);
  assert.match(accountPanel, /upsert: false/);
});

test("theme editor has one save action and a keyboard-safe real profile preview", () => {
  assert.equal((themeEditor.match(/Enregistrer mon thème/g) ?? []).length, 1);
  assert.doesNotMatch(themeEditor, /window\.location\.reload/);
  assert.doesNotMatch(themeEditor, /Appliquer ce thème|Revenir au thème|>\s*Annuler\s*</);
  assert.match(themeEditor, /Voir le profil/);
  assert.match(themeEditor, /role="dialog"/);
  assert.match(themeEditor, /aria-modal="true"/);
  assert.match(themeEditor, /event\.key === "Escape"/);
  assert.match(themeEditor, /setAttribute\("inert"/);
  assert.match(themeEditor, /<iframe/);
});

test("shared Deezer assistance requires an explicit album or track choice", () => {
  assert.match(musicAssist, /\/api\/music\/search-albums/);
  assert.match(musicAssist, /\/api\/music\/search-favorite-tracks/);
  assert.match(musicAssist, /Rechercher sur Deezer/);
  assert.match(musicAssist, /Rien n’est sélectionné/);
  assert.match(musicAssist, /onClick=\{\(\) => onSelect\(candidate\)\}/);
});
