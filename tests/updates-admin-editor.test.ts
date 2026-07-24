import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editor = readFileSync(new URL("../src/components/updates-admin-editor.tsx", import.meta.url), "utf8");
const board = readFileSync(new URL("../src/components/updates-board.tsx", import.meta.url), "utf8");
const loader = readFileSync(new URL("../src/lib/site-updates.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260724100152_admin_manage_site_updates.sql", import.meta.url), "utf8");

test("the changelog editor is visible only after checking the authenticated admin role", () => {
  assert.match(board, /<UpdatesAdminEditor updates=\{updates\}/);
  assert.match(editor, /from\("member_profiles"\)/);
  assert.match(editor, /setIsAdmin\(data\?\.role === "admin"\)/);
  assert.match(editor, /if \(!isAdmin\) return null/);
});

test("admins can edit every changelog section and persist all versions", () => {
  assert.match(editor, /Modifier les mises à jour/);
  assert.match(editor, /Ajouter une version/);
  assert.match(editor, /Nouveautés<textarea/);
  assert.match(editor, /Corrections<textarea/);
  assert.match(editor, /Améliorations<textarea/);
  assert.match(editor, /from\("site_updates"\)\.upsert/);
  assert.match(editor, /from\("site_updates"\)\.delete/);
  assert.match(editor, /router\.refresh\(\)/);
});

test("site updates remain publicly readable but database writes are admin-only", () => {
  assert.match(loader, /return siteUpdates/);
  assert.match(loader, /from\("site_updates"\)/);
  assert.match(migration, /grant select on table public\.site_updates to anon, authenticated/);
  assert.match(migration, /for insert to authenticated[\s\S]*private\.is_member_admin/);
  assert.match(migration, /for update to authenticated[\s\S]*using \(\(select private\.is_member_admin\(\)\)\)[\s\S]*with check/);
  assert.match(migration, /for delete to authenticated[\s\S]*private\.is_member_admin/);
  assert.match(migration, /alter table public\.site_updates enable row level security/);
});
