import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { siteUpdates } from "../src/data/site-updates";

const board = readFileSync(
  new URL("../src/components/tribunal-board.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/app/tribunal/tribunal.module.css", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260730110704_reveal_tribunal_results_after_completion.sql",
    import.meta.url,
  ),
  "utf8",
);
const updatesEditor = readFileSync(
  new URL("../src/components/updates-admin-editor.tsx", import.meta.url),
  "utf8",
);

test("completed participants can read anonymous results before the admin reveal", () => {
  assert.match(migration, /participant\.participant_id = caller_id/);
  assert.match(migration, /active_question\.is_active/);
  assert.match(migration, /own_response\.respondent_participant_id = caller_id/);
  assert.match(migration, /Termine toutes les questions avant de consulter les résultats/);
  assert.match(migration, /revoke all on function public\.get_tribunal_results\(bigint\)/);
  assert.match(migration, /grant execute on function public\.get_tribunal_results\(bigint\)[\s\S]*to authenticated/);
});

test("the last answer launches a friendly accessible reveal sequence", () => {
  assert.match(board, /await loadResults\(true\)/);
  assert.match(board, /TERMINER ET VOIR LES RÉSULTATS/);
  assert.match(board, /phase === "reveal"/);
  assert.match(board, /DOSSIER COMPLET/);
  assert.match(board, /aria-live="polite"/);
  assert.match(styles, /@keyframes dossier-unseals/);
  assert.match(styles, /@keyframes evidence-scan/);
  assert.match(styles, /@keyframes result-enters/);
  assert.match(styles, /prefers-reduced-motion:reduce[\s\S]*\.revealDossier/);
});

test("administrators retain edition controls and reversible moderation", () => {
  assert.match(board, /admin_set_tribunal_session_status/);
  assert.match(board, /admin_set_tribunal_response_hidden/);
  assert.match(board, /MASQUER SANS SUPPRIMER/);
  assert.match(board, /PRÉVISUALISER LES DÉGÂTS/);
});

test("minor fixes are bundled into a substantial update instead of standalone versions", () => {
  const bundledUpdate = siteUpdates.find((update) => update.id === "tribunal-results-after-completion");
  assert.ok(bundledUpdate);
  assert.equal(bundledUpdate.version, "2.14");
  assert.ok(bundledUpdate.fixed.some((item) => item.text.includes("Noir Cinéma")));
  const updateIds = new Set<string>(siteUpdates.map((item) => item.id));
  assert.equal(updateIds.has("noir-cinema-member-name-contrast"), false);
  assert.equal(updateIds.has("tribunal-validation-stamp-duration"), false);
  assert.match(migration, /delete from public\.site_updates/);
  assert.match(updatesEditor, /une petite correction visuelle ou technique ne crée jamais une version seule/);
});
