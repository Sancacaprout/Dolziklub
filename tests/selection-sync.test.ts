import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve("supabase/migrations/20260715213914_synchronize_selection_mutations.sql"),
  "utf8",
);

test("proposal changes clear the review before dropping its archive link", () => {
  assert.match(migration, /delete from public\.member_album_reviews/);
  assert.match(migration, /delete from private\.club_draw_archive_links/);
  assert.match(migration, /after update of album_title, album_artist/);
  assert.ok(
    migration.indexOf("delete from public.member_album_reviews") <
      migration.indexOf("delete from private.club_draw_archive_links"),
  );
});
