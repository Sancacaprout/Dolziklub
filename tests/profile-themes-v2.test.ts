import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { profileThemes } from "../src/lib/profile-themes";

const styles = readFileSync(resolve("src/app/profile-themes-v2.css"), "utf8");
const editor = readFileSync(resolve("src/components/auth/profile-personalization.tsx"), "utf8");
const layout = readFileSync(resolve("src/app/layout.tsx"), "utf8");
const migration = readFileSync(resolve("supabase/migrations/20260726064617_add_four_profile_themes.sql"), "utf8");

const newThemeIds = ["noir-cinema", "manga-panel", "cassette-sunset", "museum-white"] as const;
const redesignedThemeIds = ["archive", "fanzine", "chrome-2000"] as const;

test("the four new themes have distinct descriptions, palettes and preview motifs", () => {
  for (const id of newThemeIds) {
    const theme = profileThemes.find((item) => item.id === id);
    assert.ok(theme, `${id} is present`);
    assert.equal(theme.previewColors.length, 3);
    assert.ok(theme.previewMotif && theme.previewMotif !== "classic");
    assert.ok(theme.description.length > 30);
  }
  assert.equal(new Set(newThemeIds.map((id) => profileThemes.find((theme) => theme.id === id)?.previewMotif)).size, 4);
});

test("all redesigned and new themes define complete semantic palettes and component treatments", () => {
  for (const id of [...redesignedThemeIds, ...newThemeIds]) {
    const start = styles.indexOf(`[data-profile-theme="${id}"]{`);
    assert.notEqual(start, -1, `${id} has a scoped token block`);
    const tokenBlock = styles.slice(start, styles.indexOf("}", start) + 1);
    for (const token of ["--profile-background", "--profile-surface", "--profile-text", "--profile-muted", "--profile-accent", "--profile-border", "--profile-card-radius", "--profile-card-shadow", "--profile-button-radius", "--profile-image-border", "--profile-section-divider"]) {
      assert.match(tokenBlock, new RegExp(token), `${id} defines ${token}`);
    }
    assert.match(styles, new RegExp(`data-profile-theme="${id}"\\] \\.stat-cards`));
    assert.match(styles, new RegExp(`data-profile-theme="${id}"\\] \\.favorite-artist-card`));
    assert.match(styles, new RegExp(`data-profile-theme="${id}"\\] \\.favorite-clip-player`));
  }
});

test("Archive, Fanzine and Chrome 2000 use materially different visual systems", () => {
  assert.match(styles, /archive-card,decimal-leading-zero/);
  assert.match(styles, /DOSSIER · DOL ZIKLUB/);
  assert.match(styles, /fanzine.*clip-path/s);
  assert.match(styles, /fanzine.*rotate\(\.7deg\)/s);
  assert.match(styles, /DOL PLAYER 2K · ONLINE/);
  assert.match(styles, /chrome-2000.*conic-gradient/s);
});

test("theme cards expose their motif while previewing the real public profile", () => {
  assert.match(editor, /data-preview-motif=\{theme\.previewMotif \?\? "classic"\}/);
  assert.match(editor, /<iframe/);
  assert.match(editor, /\/membres\/\$\{encodeURIComponent\(account\.username\)\}\?previewTheme=\$\{previewTheme\}&profilePreview=1/);
  assert.ok(layout.indexOf('import "./profile-themes-v2.css";') > layout.indexOf('import "./globals.css";'));
});

test("the theme stylesheet protects responsive layout and reduced motion", () => {
  assert.match(styles, /overflow-x:clip/);
  assert.match(styles, /@media \(max-width:700px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /animation:none!important/);
});

test("the Supabase migration extends only the check constraint and never disables RLS", () => {
  for (const id of newThemeIds) assert.match(migration, new RegExp(`'${id}'`));
  assert.match(migration, /member_public_profiles_profile_theme_check/);
  assert.doesNotMatch(migration, /disable row level security/i);
  assert.doesNotMatch(migration, /drop policy|create policy|delete from|update public\./i);
});

test("the requested theme refinements preserve image colours and close Museum White frames", () => {
  assert.match(styles, /noir-cinema"\] img[^}]*filter:none!important/);
  assert.match(styles, /manga-panel"\] \.member-profile__initial\{filter:none\}/);
  assert.match(styles, /cassette-sunset"\]\{background-image:[^}]*radial-gradient/);
  assert.match(styles, /museum-white"\] \.member-profile\{border:1px solid #292929/);
  assert.match(styles, /museum-white"\] \.stat-cards>div[^}]*border:1px solid #292929/);
  assert.match(styles, /punk-poster"\] \.theme-card__preview[^}]*min-height:34px/);
  assert.match(styles, /jazz-lounge"\] \.theme-card__preview[^}]*min-height:34px/);
  assert.match(styles, /acid-rave"\] \.theme-card__preview[^}]*min-height:34px/);
});
