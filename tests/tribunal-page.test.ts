import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync("src/app/tribunal/page.tsx", "utf8");
const boardSource = readFileSync("src/components/tribunal-board.tsx", "utf8");
const stylesSource = readFileSync("src/app/tribunal/tribunal.module.css", "utf8");
const headerSource = readFileSync("src/components/site-header.tsx", "utf8");
const migrationSource = readFileSync("supabase/migrations/20260729081842_create_tribunal.sql", "utf8");

const expectedPrompts = [
  "Qui a les goûts musicaux les plus merdiques ?",
  "Qui mérite qu’on lui retire définitivement le droit de proposer un album ?",
  "Qui met les notes les plus débiles ?",
  "Qui a le plus de chances de mettre 5/5 à une énorme merde ?",
  "Qui a les goûts les plus fades ?",
  "Qui se prend le plus pour un critique alors qu’il raconte n’importe quoi ?",
  "Qui propose toujours des albums que personne n’a envie d’écouter ?",
  "Qui écoute probablement ses albums en faisant autre chose et invente son avis après ?",
  "Qui donnerait une mauvaise note juste parce qu’il n’aime pas la tête de l’artiste ?",
  "Qui met le plus sa vie à noter un album ?",
  "Qui a le plus souvent un avis totalement à chier ?",
  "À qui ne confierais-tu jamais l’enceinte pendant une soirée ?",
  "Termine la phrase : « Les goûts de ___ ressemblent à ___ »",
  "Quelle proposition t’a fait perdre foi dans le groupe ?",
  "Insulte musicalement un membre en une phrase.",
  "Quelle note du tableur devrait faire l’objet d’une enquête ?",
];

test("publishes the Tribunal route and navigation entry", () => {
  assert.match(pageSource, /Le Tribunal — DOL ZIKLUB/);
  assert.match(pageSource, /<TribunalBoard \/>/);
  assert.match(headerSource, /\["Le Tribunal", "\/tribunal"\]/);
});

test("seeds the sixteen requested questions in exact order and with matching answer types", () => {
  let previousIndex = -1;
  for (const prompt of expectedPrompts) {
    const index = migrationSource.indexOf(prompt);
    assert.ok(index > previousIndex, `Question absente ou désordonnée : ${prompt}`);
    previousIndex = index;
  }
  assert.equal((migrationSource.match(/\(p_session_id, \d+, /g) ?? []).length, 16);
  assert.equal((migrationSource.match(/'member', '\{\}'::jsonb\)/g) ?? []).length, 12);
  assert.match(migrationSource, /\(p_session_id, 13,[^\n]*'member_text'/);
  assert.match(migrationSource, /\(p_session_id, 14,[^\n]*'album'/);
  assert.match(migrationSource, /\(p_session_id, 15,[^\n]*'member_text'/);
  assert.match(migrationSource, /\(p_session_id, 16,[^\n]*'review'/);
});

test("supports progress, immediate persistence, resuming and editing answers", () => {
  assert.match(boardSource, /16 questions\. Aucun goût musical ne sortira intact\./);
  assert.match(boardSource, /questionIndex \+ 1} \/ \{questions\.length/);
  assert.match(boardSource, /save_my_tribunal_response/);
  assert.match(boardSource, /firstMissing/);
  assert.match(boardSource, /REPRENDRE LE TRIBUNAL/);
  assert.match(boardSource, /METTRE À JOUR ET CONTINUER/);
  assert.match(boardSource, /maxLength=\{question\.config\.maxLength \?\? 160\}/);
  assert.match(boardSource, /Chercher un album ou un artiste/);
  assert.match(boardSource, /Chercher un album, un membre ou un avis/);
});

test("keeps responses authenticated, unique, anonymous and moderated without deletion", () => {
  assert.match(migrationSource, /unique \(session_id, question_id, respondent_participant_id\)/);
  assert.match(migrationSource, /alter table public\.tribunal_responses enable row level security/);
  assert.match(migrationSource, /revoke all on table public\.tribunal_responses from anon/);
  assert.match(migrationSource, /auth\.uid\(\)/);
  assert.match(migrationSource, /Choisis un autre membre pour cette question/);
  assert.match(migrationSource, /status <> 'results_revealed' and not caller_is_admin/);
  assert.match(migrationSource, /not response\.is_hidden/);
  assert.match(migrationSource, /admin_set_tribunal_response_hidden/);
  assert.doesNotMatch(migrationSource, /delete from public\.tribunal_responses/i);
  const resultsFunction = migrationSource.slice(migrationSource.indexOf("create or replace function public.get_tribunal_results"), migrationSource.indexOf("create or replace function public.admin_create_tribunal_session"));
  assert.doesNotMatch(resultsFunction, /respondent_participant_id['"]/);
});

test("provides the complete admin lifecycle and anonymous result presentation", () => {
  for (const rpc of ["admin_create_tribunal_session", "admin_set_tribunal_session_status", "admin_set_tribunal_question_active", "admin_set_tribunal_response_hidden"]) {
    assert.match(migrationSource, new RegExp(`function public\\.${rpc}`));
  }
  assert.match(migrationSource, /status in \('draft', 'open', 'closed', 'results_revealed'\)/);
  assert.match(boardSource, /RÉSULTATS ANONYMES/);
  assert.match(boardSource, /CLASSEMENT GLOBAL/);
  assert.match(boardSource, /item\.votes} · \{item\.percentage}%/);
  assert.match(boardSource, /MASQUER SANS SUPPRIMER/);
});

test("keeps the evidence-board UI keyboard, mobile and motion accessible", () => {
  assert.match(boardSource, /aria-pressed=\{selected\}/);
  assert.match(boardSource, /role="status"/);
  assert.match(stylesSource, /:focus-visible/);
  assert.match(stylesSource, /@media \(max-width:620px\)/);
  assert.match(stylesSource, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(stylesSource, /min-height:44px/);
});
