import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const account = readFileSync(new URL("../src/components/auth/account-panel.tsx", import.meta.url), "utf8");
const themeEditor = readFileSync(new URL("../src/components/auth/profile-personalization.tsx", import.meta.url), "utf8");
const memberPage = readFileSync(new URL("../src/app/membres/[slug]/page.tsx", import.meta.url), "utf8");
const artistEditor = readFileSync(new URL("../src/components/auth/favorite-artists-panel.tsx", import.meta.url), "utf8");
const artistPublic = readFileSync(new URL("../src/components/favorite-artists-podium.tsx", import.meta.url), "utf8");
const clip = readFileSync(new URL("../src/components/youtube-clip-embed.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/music/search-artists/route.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260724065649_profile_favorite_artists_and_clip.sql", import.meta.url), "utf8");

test("private profile sections follow the requested musical order", () => {
  const quiz = account.indexOf("account-kouize-editor");
  const albums = account.indexOf("<FavoriteAlbumsPanel");
  const tracks = account.indexOf("<FavoriteTracksPanel");
  const artists = account.indexOf("<FavoriteArtistsPanel");
  const clipPanel = account.indexOf("<FavoriteClipPanel");
  assert.ok(quiz > -1 && quiz < albums);
  assert.ok(albums < tracks && tracks < artists && artists < clipPanel);
});

test("artist search is authenticated, rate limited and artist-only", () => {
  assert.match(route, /authenticatedUser/);
  assert.match(route, /consumeSearchQuota\(user\.id, "artist"\)/);
  assert.match(route, /api\.deezer\.com\/search\/artist/);
  assert.match(route, /type: "artist"/);
  assert.match(artistEditor, /candidate\.type === "artist"/);
});

test("podium has desktop 2-1-3 and mobile 1-2-3 ordering", () => {
  assert.match(artistEditor, /visualRanks: Rank\[\] = \[2, 1, 3\]/);
  assert.match(artistPublic, /const visible = \[2, 1, 3\]/);
  assert.match(css, /favorite-artist-card--rank-1[^}]*transform:translateY/);
  assert.match(css, /favorite-artist-card--rank-1 \{ order:1; \}/);
  assert.match(css, /favorite-artist-card--rank-2 \{ order:2; \}/);
  assert.match(css, /favorite-artist-card--rank-3 \{ order:3; \}/);
});

test("clip iframe is privacy enhanced, lazy and never autoplays", () => {
  assert.match(clip, /youtubePrivacyEmbedUrl/);
  assert.match(clip, /loading="lazy"/);
  assert.match(clip, /allowFullScreen/);
  assert.doesNotMatch(clip, /autoplay/);
});

test("theme preview reuses the complete real public profile route", () => {
  assert.match(themeEditor, /<iframe/);
  assert.match(themeEditor, /\/membres\/\$\{encodeURIComponent\(account\.username\)\}/);
  assert.match(themeEditor, /previewTheme=\$\{previewTheme\}/);
  assert.match(memberPage, /MemberFavoriteArtists/);
  assert.match(memberPage, /MemberFavoriteClip/);
  assert.match(memberPage, /MemberStatsCards/);
  assert.match(memberPage, /stats\.listened\.map/);
  assert.match(memberPage, /stats\.proposed\.map/);
  assert.match(memberPage, /forcedTheme=\{forcedTheme\}/);
  assert.doesNotMatch(themeEditor, /ProfileThemePreview/);
});

test("migration keeps public reads and owner-only writes behind RLS", () => {
  assert.match(migration, /alter table public\.profile_favorite_artists enable row level security/);
  assert.match(migration, /Public favorite artists are readable/);
  assert.match(migration, /participant_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /with check \(\s*participant_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /unique \(participant_id, rank\)/);
  assert.match(migration, /unique \(participant_id, artist_name_key\)/);
  assert.match(migration, /favorite_clip_youtube_id ~ '\^\[A-Za-z0-9_-\]\{11\}\$'/);
  assert.doesNotMatch(migration, /disable row level security/i);
});

test("artist ranks use gold, silver and bronze medals with spaced search controls", () => {
  for (const symbol of ["1F947", "1F948", "1F949"]) {
    assert.match(artistEditor, new RegExp(`\\\\u\\{${symbol}\\}`));
    assert.match(artistPublic, new RegExp(`\\\\u\\{${symbol}\\}`));
  }
  assert.match(css, /favorite-artist-editor-card > \.favorite-track-search \{ margin-top:\.75rem; \}/);
});
