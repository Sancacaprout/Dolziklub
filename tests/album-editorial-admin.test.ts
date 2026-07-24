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

const coverMigration = readFileSync(resolve("supabase/migrations/20260718074218_add_album_cover_overrides.sql"), "utf8");
const coverRoute = readFileSync(resolve("src/app/api/admin/album-cover/route.ts"), "utf8");
const albumCatalogPage = readFileSync(resolve("src/app/albums/page.tsx"), "utf8");
const liveRefresh = readFileSync(resolve("src/components/live-club-refresh.tsx"), "utf8");
const userScopedCoverMigration = readFileSync(resolve("supabase/migrations/20260718081436_admin_album_cover_user_scoped_upload.sql"), "utf8");
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
test("allows only admins to replace live and archived album covers", () => {
  assert.match(editor, /Modifier la pochette/);
  assert.match(editor, /fetch\("\/api\/admin\/album-cover"/);
  assert.match(albumPage, /archiveAlbumId=/);
  assert.match(coverRoute, /authenticatedUser\(request\)/);
  assert.match(coverRoute, /profile\?\.role !== "admin"/);
  assert.match(coverRoute, /album_cover_overrides/);
  assert.match(coverMigration, /enable row level security/);
  assert.match(coverMigration, /private\.is_member_admin\(\)/);
  assert.match(liveAlbums, /applyArchiveCoverOverrides/);
  assert.match(albumCatalogPage, /<LiveClubRefresh/);
  assert.match(albumPage, /<LiveClubRefresh/);
  assert.match(liveRefresh, /table: "album_cover_overrides"/);
  assert.match(userScopedCoverMigration, /album_cover_overrides_cover_path_check/);
});
