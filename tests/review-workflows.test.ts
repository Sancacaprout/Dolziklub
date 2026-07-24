import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(resolve("supabase/migrations/20260718194951_secure_review_workflows.sql"), "utf8");
const tableur = readFileSync(resolve("src/components/tableur-board.tsx"), "utf8");

test("current draw reviews use an assigned-listener RPC", () => {
  assert.match(migration, /create or replace function public\.save_my_draw_review/);
  assert.match(migration, /entry\.listened_by = current_member_id/);
  assert.match(migration, /draw\.status in \('published', 'locked'\)/);
  assert.match(migration, /on conflict \(album_id, member_id\) do update/);
  assert.match(tableur, /rpc\("save_my_draw_review"/);
  assert.match(tableur, /rpc\("reset_my_draw_review"/);
});

test("archived reviews accept the authenticated username or display name", () => {
  assert.match(migration, /current_display_name/);
  assert.match(migration, /lower\(archive_review\.listener_username\) in \(current_username, current_display_name\)/);
  assert.match(migration, /grant execute on function public\.save_my_archived_album_review[\s\S]*to authenticated/);
});