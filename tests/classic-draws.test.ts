import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260802074957_refactor_draw_history_badges_and_global_verdicts.sql", "utf8");
const tableur = readFileSync("src/components/tableur-board.tsx", "utf8");
const matcher = readFileSync("src/lib/oriented-draw-matcher.ts", "utf8");

test("persists exact stable-id classic assignments with database guards", () => {
  assert.match(migration, /admin_create_classic_draw_from_assignments/);
  assert.match(migration, /count\(distinct id\).*p_proposer_ids/s);
  assert.match(migration, /p_proposer_ids\[slot\]=p_listener_ids\[slot\]/);
  assert.match(migration, /array_agg\(id order by id\).*p_listener_ids/s);
  assert.match(migration, /admin_replace_classic_draw_assignments/);
});

test("uses the complete directed history and an exact minimum-cost assignment", () => {
  assert.match(matcher, /REPEAT_COST/);
  assert.match(matcher, /previousDraws\.length \* REPEAT_COST/);
  assert.match(matcher, /lastDraw \* RECENCY_COST/);
  assert.match(matcher, /proposer\.id}>\$\{listener\.id/);
  assert.doesNotMatch(matcher, /Math\.random/);
  assert.match(tableur, /prepareClassicAssignments/);
  assert.match(tableur, /club_draw_entries.*proposed_by.*listened_by/s);
  assert.match(tableur, /Analyse de l’historique des duos/);
  assert.match(tableur, /Régénérer les duos/);
});

test("keeps manual editing directional while allowing an explicit minimal-repeat fallback", () => {
  assert.match(tableur, /return proposer && listener \? `\$\{proposer\}\|\$\{listener\}` : ""/);
  assert.match(tableur, /const proposedOptions = options\.filter\(\(member\) => member\.username !== current\.listener\)/);
  assert.match(tableur, /const listenerOptions = options\.filter\(\(member\) => member\.username !== current\.proposer\)/);
  assert.match(tableur, /draw\.pairing_summary\?\.warning/);
  assert.match(tableur, /repeatedPairs\.length \? .*le tirage reste cohérent/s);
});
