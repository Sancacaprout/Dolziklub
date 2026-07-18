import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { albums } from "../src/data/albums";
import { albumIdentityKey, findArchiveAlbumMatch } from "../src/lib/album-live-sync";

const migration = readFileSync(
  resolve("supabase/migrations/20260715222649_allow_half_step_verdicts_and_proposal_replacements.sql"),
  "utf8",
);
const tableur = readFileSync(resolve("src/components/tableur-board.tsx"), "utf8");
const home = readFileSync(resolve("src/app/page.tsx"), "utf8");
const liveAlbums = readFileSync(resolve("src/lib/live-albums.ts"), "utf8");
const game = readFileSync(resolve("src/components/hero-vinyl-game.tsx"), "utf8");

test("accepts half-step verdicts and returns the saved review", () => {
  assert.match(migration, /drop constraint if exists member_album_reviews_integer_rating/);
  assert.match(migration, /check \(rating \* 2 = trunc\(rating \* 2\)\)/);
  assert.match(tableur, /Array\.from\(\{ length: 11 \}, \(_, index\) => index \/ 2\)/);
  assert.match(tableur, /upsert\([\s\S]*?onConflict: "album_id,member_id"[\s\S]*?\.select\("id"\)\.single\(\)/);
});

test("lets a proposer replace an album and clears the obsolete verdict", () => {
  assert.match(migration, /drop trigger if exists club_draw_entries_lock_reviewed_proposals/);
  assert.match(migration, /create policy "Proposers can edit their published draw slot"/);
  assert.doesNotMatch(
    migration.slice(migration.indexOf('create policy "Proposers can edit their published draw slot"')),
    /not exists \([\s\S]*?member_album_reviews/,
  );
});

test("loads newly proposed live albums on the dynamic home page", () => {
  assert.match(home, /getClubSnapshot\(\)/);
  assert.match(home, /export const dynamic = "force-dynamic"/);
  assert.match(liveAlbums, /\.from\("club_draw_entries"\)/);
  assert.match(liveAlbums, /\.order\("updated_at", \{ ascending: false \}\)/);
  assert.match(liveAlbums, /supabase\.rpc\("get_public_draw_reviews"\)/);
});

test("renders the vinyl mini-game at a 60 FPS target", () => {
  assert.match(game, /const TARGET_FRAME_MS = 1000 \/ 60/);
});
test("reuses complete archive records for the current draw without duplicates", () => {
  const matches = [
    ["Yeezus", "Kanye West", "archive-46"],
    ["Pleins Phares Pt.2", "Favé", "archive-47"],
    ["6 Feet Beneath the Moon", "King Krule", "archive-48"],
    ["FANTASYLAND", "Mr. Fantasy", "archive-49"],
  ] as const;

  for (const [title, artist, expectedId] of matches) {
    const album = findArchiveAlbumMatch(albums, title, artist);
    assert.equal(album?.id, expectedId);
    assert.ok(album?.cover);
    assert.ok(album?.albumDescription);
  }

  assert.equal(
    albumIdentityKey("Pleins Phares, pt. 2", "Favé"),
    albumIdentityKey("Pleins Phares Pt.2", "Fave"),
  );
  assert.match(liveAlbums, /materializeLiveAlbum/);
  assert.match(liveAlbums, /getSynchronizedAlbums/);
  assert.match(home, /albumIdentityKey\(album\.title, album\.artist\)/);
});


test("keeps proposals and listens limited to the latest published draw", () => {
  assert.match(tableur, /const latestPublishedDraw = \[\.\.\.draws\]\.filter\(\(draw\) => draw\.status === "published"\)\.sort/);
  assert.match(tableur, /const availableDraws = new Set\(latestPublishedDraw \? \[latestPublishedDraw\.draw_number\] : \[\]\)/);
});
