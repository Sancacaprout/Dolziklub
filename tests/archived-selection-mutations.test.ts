import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(resolve("supabase/migrations/20260717103000_fix_archived_selection_reviews.sql"), "utf8");
const tableur = readFileSync(resolve("src/components/tableur-board.tsx"), "utf8");

test("older selection verdicts use a listener-scoped RPC", () => {
  assert.match(migration, /create or replace function public\.save_my_archived_album_review/);
  assert.match(migration, /profile\.id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /lower\(archive_review\.listener_username\) = lower\(current_username\)/);
  assert.match(migration, /grant execute on function public\.save_my_archived_album_review[\s\S]*to authenticated/);
  assert.match(tableur, /rpc\("save_my_archived_album_review"/);
});

test("older archive cards remain editable and resettable", () => {
  assert.match(tableur, /archiveRecordMap\.get\(storageArchiveRecordId\(album\.id\)\)/);
  assert.match(tableur, /p_reset: true/);
  assert.match(tableur, /rpc\("save_my_archived_album_review"/);
});

test("a locked draw keeps every unanswered assigned album in the older review selection", () => {
  assert.match(tableur, /draw\?\.status === "locked"/);
  assert.match(tableur, /isAssignedToMember\(entry, member, "listener"\)/);
  assert.match(tableur, /!reviewMap\.has\(entry\.id\)/);
  assert.match(tableur, /rpc\("save_my_draw_review"/);
});

test("a saved older verdict leaves the pending selection immediately", () => {
  assert.match(tableur, /return effectiveRating === null \|\| effectiveRating === undefined/);
  assert.match(tableur, /savedLockedReviews/);
});