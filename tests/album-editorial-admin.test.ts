import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const schemaMigration = readFileSync(
  resolve("supabase/migrations/20260716075525_add_admin_album_editorial_metadata.sql"),
  "utf8",
);
const grantsMigration = readFileSync(
  resolve("supabase/migrations/20260716080511_tighten_album_editorial_metadata_grants.sql"),
  "utf8",
);
const editor = readFileSync(resolve("src/components/album-editorial-editor.tsx"), "utf8");
const albumPage = readFileSync(resolve("src/app/albums/[slug]/page.tsx"), "utf8");
const liveAlbums = readFileSync(resolve("src/lib/live-albums.ts"), "utf8");

test("protects album editorial writes with admin-only Supabase policies", () => {
  assert.match(schemaMigration, /alter table public\.album_editorial_metadata enable row level security/);
  assert.match(schemaMigration, /private\.is_member_admin\(\)/);
  assert.match(schemaMigration, /\(select auth\.uid\(\)\) = updated_by/);
  assert.match(grantsMigration, /revoke all privileges[\s\S]*from anon, authenticated/);
  assert.match(grantsMigration, /grant select[\s\S]*to anon, authenticated/);
  assert.match(grantsMigration, /grant insert, update, delete[\s\S]*to authenticated/);
});

test("shows the editor only to admins and refreshes after writes", () => {
  assert.match(editor, /\.from\("member_profiles"\)[\s\S]*\.select\("role"\)/);
  assert.match(editor, /data\?\.role === "admin"/);
  assert.match(editor, /if \(!isAdmin\) return null/);
  assert.match(editor, /\.from\("album_editorial_metadata"\)[\s\S]*\.upsert\(/);
  assert.match(editor, /\.delete\(\)[\s\S]*\.eq\("draw_entry_id", drawEntryId\)/);
  assert.match(editor, /router\.refresh\(\)/);
});

test("places every editable field before the related album section", () => {
  for (const label of [
    "Année de sortie",
    "Format / projet",
    "Origine",
    "Langue",
    "Genres",
    "Présentation de l’artiste",
    "À propos de l’album",
  ]) {
    assert.match(editor, new RegExp(label));
  }

  const editorPosition = albumPage.indexOf("<AlbumEditorialEditor");
  const relatedPosition = albumPage.indexOf("À fouiller ensuite");
  assert.ok(editorPosition >= 0 && relatedPosition > editorPosition);
});

test("merges Supabase editorial metadata into synchronized album records", () => {
  assert.match(liveAlbums, /\.from\("album_editorial_metadata"\)/);
  assert.match(liveAlbums, /editorial\?\.album_description/);
  assert.match(liveAlbums, /editorial\?\.artist_description/);
  assert.match(albumPage, /À PROPOS DE L’ARTISTE/);
  assert.match(liveAlbums, /liveEntryId: entry\.id/);
});