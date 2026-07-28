import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  extraListeningStatusLabels,
  isExtraListeningActive,
} from "../src/lib/extra-listenings";

const migration = readFileSync(
  "supabase/migrations/20260728192203_extra_listening_requests.sql",
  "utf8",
);
const workspace = readFileSync("src/components/extra-listenings.tsx", "utf8");
const tableur = readFileSync("src/components/tableur-board.tsx", "utf8");
const liveDraws = readFileSync("src/components/live-draws.tsx", "utf8");
const bonusWorkspace = readFileSync(
  "src/components/bonus-review-workspace.tsx",
  "utf8",
);
const updates = readFileSync("src/data/site-updates.ts", "utf8");

test("extra listening requests own their complete lifecycle outside official draw entries", () => {
  assert.match(migration, /create table if not exists public\.extra_listening_requests/);
  assert.match(migration, /draw_number integer not null references public\.club_draws/);
  assert.match(migration, /pending_proposal.*album_proposed.*listening.*reviewed.*cancelled/s);
  assert.match(migration, /extra_listening_requests_active_pair_idx/);
  assert.match(migration, /where status in \('pending_proposal', 'album_proposed', 'listening'\)/);
  assert.match(migration, /num_nonnulls\(album_title, album_artist\) = 2/);
  assert.match(migration, /status = 'reviewed'.*review is not null.*rating is not null/s);
  assert.doesNotMatch(
    migration,
    /(insert into|update|delete from) public\.club_draw_entries/i,
  );
  assert.doesNotMatch(
    migration,
    /(insert into|update|delete from) public\.member_album_reviews/i,
  );
});

test("server-side RPCs enforce participants, ownership, locks and no self request", () => {
  assert.match(migration, /alter table public\.extra_listening_requests enable row level security/);
  assert.match(migration, /revoke all on table public\.extra_listening_requests from public, anon, authenticated/);
  assert.match(migration, /create policy "Extra listenings are publicly readable"/);
  assert.match(migration, /requester\.id = proposer\.id/);
  assert.match(migration, /lower\(requester\.username\) = any \(draw\.participant_usernames\)/);
  assert.match(migration, /lower\(proposer\.username\) = any \(draw\.participant_usernames\)/);
  assert.match(migration, /request\.requester_id <> \(select auth\.uid\(\)\)/);
  assert.match(migration, /request\.proposer_id.*private\.is_member_admin\(\)/s);
  assert.match(migration, /for update/);
  assert.match(migration, /request\.status in \('reviewed', 'cancelled'\)/);
  assert.match(migration, /revoke all on function public\.create_extra_listening_request[\s\S]*from public, anon/);
  assert.match(migration, /grant execute on function public\.create_extra_listening_request[\s\S]*to authenticated/);
});

test("the requester and proposer complete the workflow through explicit actions", () => {
  assert.match(workspace, /Envoyer ma demande/);
  assert.match(workspace, /create_extra_listening_request/);
  assert.match(workspace, /p_proposer_username/);
  assert.match(workspace, /Proposer cet album/);
  assert.match(workspace, /propose_extra_listening_album/);
  assert.match(workspace, /start_my_extra_listening/);
  assert.match(workspace, /save_my_extra_listening_review/);
  assert.match(workspace, /cancel_extra_listening_request/);
  assert.match(workspace, /clear_extra_listening_album/);
  assert.match(workspace, /selectedDraw\?\.participant_usernames/);
  assert.match(workspace, /!isSameMember\(candidate\.username, member\.username\)/);
});

test("every draw keeps its own attached extra-listening subtable", () => {
  assert.match(liveDraws, /<ExtraListeningTable/);
  assert.match(liveDraws, /drawNumber=\{draw\.draw_number\}/);
  assert.match(workspace, /Écoutes supplémentaires du tirage/);
  assert.match(workspace, /HORS TIRAGE CLASSIQUE/);
  assert.match(workspace, /Demandeur/);
  assert.match(workspace, /Proposé par/);
  assert.match(workspace, /Best track/);
  assert.match(workspace, /Worst track/);
  assert.match(workspace, /Actions/);
});

test("tableur navigation scrolls once and separates bonus reviews from new albums", () => {
  assert.match(tableur, /Demander une écoute supplémentaire/);
  assert.match(tableur, /consumedExtraScrollRequest/);
  assert.match(tableur, /consumedExtraNavigation/);
  assert.match(tableur, /params\.delete\("extra"\)/);
  assert.match(tableur, /window\.history\.replaceState/);
  assert.match(workspace, /id="extra-listening-workspace"/);
  assert.match(bonusWorkspace, /Donner un avis bonus sur/);
  assert.match(bonusWorkspace, /d\\u00e9j\\u00e0 pr\\u00e9sent dans un tirage/);
});

test("status labels and the public changelog use the agreed terminology", () => {
  assert.equal(extraListeningStatusLabels.pending_proposal, "En attente de proposition");
  assert.equal(extraListeningStatusLabels.album_proposed, "Album proposé");
  assert.equal(extraListeningStatusLabels.listening, "En cours d’écoute");
  assert.equal(extraListeningStatusLabels.reviewed, "Écouté et évalué");
  assert.equal(extraListeningStatusLabels.cancelled, "Annulée");
  assert.equal(isExtraListeningActive("reviewed"), false);
  assert.equal(isExtraListeningActive("listening"), true);
  assert.match(updates, /id: "extra-listening-requests"/);
  assert.match(updates, /version: "2\.6"/);
  assert.match(migration, /'extra-listening-requests'/);
  assert.match(updates, /restent en dehors des moyennes, affectations et classements officiels/);
});
