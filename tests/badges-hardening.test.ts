import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const migration = readFileSync(resolve("supabase/migrations/20260801194623_harden_public_badge_display.sql"), "utf8");

test("public equipped badges use an RLS-backed invoker function", () => {
  assert.match(migration, /get_public_equipped_badges[\s\S]*security invoker/);
  assert.doesNotMatch(migration, /get_public_equipped_badges[\s\S]*join private\.badge_definitions/);
  assert.match(migration, /from public\.participant_badge_slots equipped/);
});

test("secret metadata becomes public only when its owner equips the badge", () => {
  assert.match(migration, /select \* into definition from private\.badge_definitions/);
  assert.match(migration, /participant_badge_slots\(participant_id,slot,badge_key,name,description,image_path,rarity\)/);
  assert.match(migration, /claimed_at is not null/);
});

test("badge reads use one ownership-or-admin RLS policy", () => {
  assert.match(migration, /participant_id=\(select auth\.uid\(\)\) or \(select private\.is_member_admin\(\)\)/);
});
