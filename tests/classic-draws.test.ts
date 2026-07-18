import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260718150717_auto_generate_classic_draw_pairs.sql", "utf8");
const tableur = readFileSync("src/components/tableur-board.tsx", "utf8");

test("generates complete classic draw permutations without reusing an oriented pair", () => {
  assert.match(migration, /for attempt in 1\.\.5000 loop/);
  assert.match(migration, /proposer\.id = listener\.id/);
  assert.match(migration, /earlier_entry\.proposed_by = proposer\.id/);
  assert.match(migration, /earlier_entry\.listened_by = listener\.id/);
  assert.match(migration, /lower\(proposer\.username\) \|\| '\|' \|\| lower\(listener\.username\)/);
  assert.match(migration, /insert into public\.club_draw_entries \([\s\S]*?proposed_by_name,[\s\S]*?listened_by_name/);
});

test("keeps classic draw editing directional and sends archive history to Supabase", () => {
  assert.match(tableur, /return proposer && listener \? `\$\{proposer\}\|\$\{listener\}` : ""/);
  assert.match(tableur, /p_legacy_forbidden_pairs: legacyForbiddenPairs/);
  assert.match(tableur, /Duos générés aléatoirement/);
});
