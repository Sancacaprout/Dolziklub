import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { badgeKeys } from "../src/lib/badges/types";

const schema = readFileSync(resolve("supabase/migrations/20260801191742_add_complete_badge_system.sql"), "utf8");
const engine = readFileSync(resolve("supabase/migrations/20260801192614_add_badge_evaluation_engine.sql"), "utf8");
const api = readFileSync(resolve("supabase/migrations/20260801192813_connect_badge_events_and_collection_api.sql"), "utf8");

test("the badge registry contains exactly 29 stable opaque keys and assets", () => {
  assert.equal(badgeKeys.length, 29);
  assert.equal(new Set(badgeKeys).size, 29);
  for (const [index, key] of badgeKeys.entries()) {
    assert.equal(key, `b${String(index + 1).padStart(2, "0")}`);
    assert.ok(existsSync(resolve(`public/badges/${key}.png`)));
  }
  assert.equal(readdirSync(resolve("public/badges")).filter((name) => name.endsWith(".png")).length, 29);
});

test("badge persistence is owner-private and public slots stay read-only", () => {
  assert.match(schema, /participant_id uuid not null references public\.member_public_profiles\(id\)/);
  assert.match(schema, /alter table public\.participant_badges enable row level security/);
  assert.match(schema, /participant_id = \(select auth\.uid\(\)\)/);
  assert.match(schema, /revoke all on table public\.participant_badges from public, anon, authenticated/);
  assert.match(schema, /slot smallint not null check \(slot between 1 and 3\)/);
  assert.match(schema, /unique \(participant_id, badge_key\)/);
  assert.doesNotMatch(schema, /grant (insert|update|delete).*participant_badges.*authenticated/i);
});

test("all cumulative thresholds and temporal boundaries are enforced server-side", () => {
  for (const threshold of [1, 5, 20, 30]) assert.match(engine, new RegExp(`proposalCount'\\)::int>=${threshold}`));
  assert.match(engine, /ratingAverage'\)::numeric between 2\.9 and 3\.1/);
  assert.match(engine, /ratingAverage'\)::numeric<2\.5/);
  assert.match(engine, /ratingAverage'\)::numeric>3\.8/);
  assert.match(engine, /interval '24 hours'/);
  assert.match(engine, /interval '30 days'/);
  assert.match(engine, /on conflict\(participant_id,badge_key\) do nothing/);
});

test("unlock events cover proposals, every review flow, Wheely and Tribunal", () => {
  for (const table of ["club_draw_entries", "member_album_reviews", "archived_album_reviews", "bonus_album_reviews", "extra_listening_requests", "participant_achievements", "tribunal_sessions"]) {
    assert.match(api, new RegExp(table));
  }
  assert.match(api, /get_my_badge_collection/);
  assert.match(api, /claim_my_badge/);
  assert.match(api, /set_my_equipped_badge/);
  assert.match(api, /get_public_equipped_badges/);
  assert.match(api, /Badge secret/);
  assert.match(api, /historical-backfill/);
});

test("badge art stays intact while custom theme tokens style its frame", () => {
  const css = readFileSync(resolve("src/app/badges.css"), "utf8");
  const themeCss = readFileSync(resolve("src/app/membres/[slug]/profile-badges.css"), "utf8");
  assert.match(css, /filter:none!important/);
  assert.match(css, /object-fit:contain!important/);
  assert.match(themeCss, /--profile-custom-badge-bg/);
  assert.match(themeCss, /--profile-custom-badge-border/);
  assert.match(themeCss, /--profile-custom-badge-shadow/);
});
