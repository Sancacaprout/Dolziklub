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
const automaticMigration = readFileSync(
  new URL(
    "../supabase/migrations/20261126141152_automate_tribunal_results_after_completion.sql",
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

test("completion is persisted and backfilled for current and historical sessions", () => {
  assert.match(automaticMigration, /add column if not exists completed_at timestamptz/);
  assert.match(automaticMigration, /refresh_tribunal_participant_completion/);
  assert.match(automaticMigration, /sync_tribunal_response_completion/);
  assert.match(automaticMigration, /sync_tribunal_question_completion/);
  assert.match(automaticMigration, /select participant\.session_id, participant\.participant_id[\s\S]*refresh_tribunal_participant_completion/);
  assert.doesNotMatch(automaticMigration, /delete from public\.tribunal_responses/i);
});

test("member result access depends on membership and personal completion, never admin release", () => {
  const guardStart = automaticMigration.indexOf("completed_at_guard constant");
  const guardEnd = automaticMigration.indexOf("$guard$;", guardStart);
  const completionGuard = automaticMigration.slice(guardStart, guardEnd);
  assert.ok(guardStart > -1 && guardEnd > guardStart);
  assert.match(completionGuard, /participant\.participant_id = caller_id/);
  assert.match(completionGuard, /participant\.completed_at is not null/);
  assert.doesNotMatch(completionGuard, /results_revealed/);
  assert.match(automaticMigration, /Le garde d’accès du Tribunal a changé; migration arrêtée/);
});

test("the aggregate RPC exposes only provisional or complete progress counters", () => {
  const rpcStart = automaticMigration.indexOf("create or replace function public.get_tribunal_results_v3");
  const rpcEnd = automaticMigration.indexOf("revoke all on function public.get_tribunal_results_v3", rpcStart);
  const resultsRpc = automaticMigration.slice(rpcStart, rpcEnd);
  assert.ok(rpcStart > -1 && rpcEnd > rpcStart);
  assert.match(resultsRpc, /public\.get_tribunal_results_v2\(p_session_id\)/);
  assert.match(resultsRpc, /completedParticipants/);
  assert.match(resultsRpc, /totalParticipants/);
  assert.match(resultsRpc, /isComplete/);
  assert.doesNotMatch(resultsRpc, /respondent_participant_id/);
  assert.match(automaticMigration, /revoke all on function public\.get_tribunal_results_v3\(bigint\)[\s\S]*from public, anon, authenticated/);
  assert.match(automaticMigration, /grant execute on function public\.get_tribunal_results_v3\(bigint\)[\s\S]*to authenticated/);
  assert.match(automaticMigration, /revoke all on table public\.tribunal_responses from public, anon, authenticated/);
  assert.match(automaticMigration, /free_answers := ''\[\]''::jsonb/);
  assert.match(automaticMigration, /grant select \(session_id, participant_id, joined_at\)/);
  assert.doesNotMatch(board, /result\.freeAnswers/);
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

test("the UI shows evolving aggregate results without an administrator action", () => {
  assert.match(board, /get_tribunal_results_v3/);
  assert.match(board, /RÉSULTATS PROVISOIRES/);
  assert.match(board, /RÉSULTATS COMPLETS/);
  assert.match(board, /completedParticipants/);
  assert.match(board, /totalParticipants/);
  assert.match(board, /setInterval\(\(\) => void loadResults\(\), 30_000\)/);
  assert.match(board, /ACTUALISER/);
  assert.doesNotMatch(board, /Les dégâts ne sont pas encore consultables/);
  assert.doesNotMatch(board, /RÉVÉLER LES RÉSULTATS/);
  assert.match(styles, /\.resultsProgress/);
  assert.match(styles, /\.resultsProgressComplete/);
});

test("administrators retain edition controls and reversible moderation", () => {
  assert.match(board, /admin_set_tribunal_session_status/);
  assert.match(board, /admin_set_tribunal_response_hidden/);
  assert.match(board, /MASQUER SANS SUPPRIMER/);
  assert.match(board, /PRÉVISUALISER LES DÉGÂTS/);
});

test("a failed save stays on the current draft and only a successful final save opens results", () => {
  const save = board.slice(board.indexOf("const saveAnswer"), board.indexOf("const spendJoker"));
  assert.match(save, /if \(error\) throw error;\s+await advanceAfterSave/);
  assert.doesNotMatch(save, /setDraft\(/);
  assert.match(board, /const nextMissing = questions\.findIndex\(\(item\) => item\.id !== question\.id && !item\.answer\)/);
  assert.match(board, /if \(nextMissing === -1\) await loadResults\(true\)/);
  assert.match(board, /Historique des éditions/);
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
