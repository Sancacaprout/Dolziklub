import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const board = readFileSync(resolve("src/components/tableur-board.tsx"), "utf8");
const archive = JSON.parse(readFileSync(resolve("src/data/albums.generated.json"), "utf8")) as Array<{
  position: number;
  title: string;
  rating: number | null;
  shortReview: string | null;
  bestTrack: { title: string | null };
  worstTrack: { title: string | null };
}>;

test("renders Black Sunday in draw 05 without mutating the DOM", () => {
  assert.match(board, /draw: 4, albums: inRange\(29, 36\)/);
  assert.match(board, /draw: 5, albums: inRange\(37, 45\)/);
  assert.equal(existsSync(resolve("src/app/tableur/template.tsx")), false);
  assert.equal(existsSync(resolve("src/components/historical-draw-boundary-fix.tsx")), false);
});
test("uses the same source review for 2005 and PLAY!", () => {
  const album2005 = archive.find((album) => album.position === 26);
  const play = archive.find((album) => album.position === 27);

  assert.equal(album2005?.title, "2005");
  assert.equal(play?.title, "PLAY!");
  assert.deepEqual(
    play && [play.rating, play.shortReview, play.bestTrack.title, play.worstTrack.title],
    album2005 && [album2005.rating, album2005.shortReview, album2005.bestTrack.title, album2005.worstTrack.title],
  );
});
