import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const game = readFileSync(resolve("src/components/hero-vinyl-game.tsx"), "utf8");
const selector = readFileSync(resolve("src/components/auth/profile-personalization.tsx"), "utf8");
const boundary = readFileSync(resolve("src/components/profile-theme-boundary.tsx"), "utf8");
const memberPage = readFileSync(resolve("src/app/membres/[slug]/page.tsx"), "utf8");
const route = readFileSync(resolve("src/app/api/wheely/unlock/route.ts"), "utf8");
const styles = readFileSync(resolve("src/app/profile-themes-v2.css"), "utf8");
const migration = readFileSync(resolve("supabase/migrations/20260726073026_wheely_theme_unlock.sql"), "utf8");

test("Wheely uses one non-tiled long-page vinyl background", () => {
  assert.match(styles, /--wheely-page-record-size/);
  assert.match(styles, /background-repeat:no-repeat,no-repeat,no-repeat/);
  assert.match(styles, /background-size:100% 100%,var\(--wheely-page-record-size\)/);
  assert.match(styles, /data-profile-theme="wheely"\]\s*::before \{ content:none!important; \}/);
});

test("locked Wheely remains previewable but cannot be selected or saved", () => {
  assert.match(selector, /participant_achievements/);
  assert.match(selector, /disabled=\{theme\.id === "wheely" && wheelyLocked\}/);
  assert.match(selector, /Termine le mini-jeu Wheely pour débloquer ce thème/);
  assert.match(selector, /save_my_profile_theme/);
  assert.match(selector, /themeLocked=1/);
  assert.match(boundary, /APERÇU — THÈME VERROUILLÉ/);
  assert.match(memberPage, /lockedPreview=\{query\.themeLocked === "1"\}/);
});

test("the existing audio ending remains the victory and requests a signed server unlock", () => {
  assert.match(game, /onEnded=\{win\}/);
  assert.match(game, /action: "start"/);
  assert.match(game, /action: "complete", runToken, score, distance/);
  assert.match(game, /THÈME WHEELY DÉBLOQUÉ/);
  assert.match(route, /MINIMUM_RUN_MS = 72_000/);
  assert.match(route, /createHmac\("sha256"/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /claim\.sub !== user\.id/);
  assert.doesNotMatch(route, /body\?\.unlocked/);
});

test("Supabase owns the achievement and rejects direct locked theme updates", () => {
  assert.match(migration, /create table if not exists public\.participant_achievements/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /Members read their own achievements/);
  assert.match(migration, /participant_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /grant (insert|update|delete).*participant_achievements.*authenticated/i);
  assert.match(migration, /legacy-equipped-theme/);
  assert.match(migration, /enforce_profile_theme_unlock/);
  assert.match(migration, /Termine le mini-jeu Wheely avant d''équiper ce thème/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /save_my_profile_theme/);
  assert.doesNotMatch(migration, /disable row level security/i);
});