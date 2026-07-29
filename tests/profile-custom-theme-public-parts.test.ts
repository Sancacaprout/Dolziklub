import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const memberPage = read("../src/app/membres/[slug]/page.tsx");
const boundary = read("../src/components/profile-theme-boundary.tsx");
const serverTheme = read("../src/lib/profile-theme-server.ts");
const customCss = read("../src/app/profile-custom-theme.css");

test("the public profile order remains owned by the site", () => {
  const orderedParts = [
    "<MemberPublicProfile",
    "<MemberFavoriteAlbums",
    "<MemberFavoriteTracks",
    "<MemberFavoriteArtists",
    "<MemberFavoriteClip",
    "<MemberStatsCards",
    'data-profile-part="listened"',
    'data-profile-part="proposed"',
    "<MemberBonusReviews",
  ];
  let cursor = -1;
  for (const part of orderedParts) {
    const next = memberPage.indexOf(part);
    assert.ok(next > cursor, `${part} must remain after the previous public section`);
    cursor = next;
  }
});

test("the custom stylesheet cannot hide, reorder or reposition public sections", () => {
  assert.doesNotMatch(customCss, /data-profile-part[^\n{]*\{[^}]*\b(?:display\s*:\s*none|visibility\s*:\s*hidden|order\s*:|grid-area\s*:|position\s*:\s*absolute|opacity\s*:\s*0)\b/is);
  assert.doesNotMatch(customCss, /data-profile-part[^\n{]*\{[^}]*margin(?:-[a-z]+)?\s*:\s*-/is);
});

test("profile theme selection is server loaded without Realtime", () => {
  assert.match(memberPage, /getPublishedProfileTheme/);
  assert.match(boundary, /initialTheme/);
  assert.doesNotMatch(boundary, /getSupabaseBrowserClient|postgres_changes|\.channel\(|removeChannel/);
  assert.match(serverTheme, /profile_custom_theme_publications/);
  assert.match(serverTheme, /validateProfileCustomThemeConfig/);
});

test("an invalid or disabled custom publication falls back safely", () => {
  assert.match(serverTheme, /isProfileCustomThemeEditorEnabled\(\)/);
  assert.match(serverTheme, /if \(!validation\.ok\) return emptyPublishedProfileTheme/);
});
