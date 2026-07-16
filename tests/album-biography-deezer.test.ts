import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const albumPage = readFileSync("src/app/albums/[slug]/page.tsx", "utf8");

test("best and worst tracks expose the Deezer player with album-aware matching", () => {
  assert.match(albumPage, /MusicTrackChoiceButton/);
  assert.equal((albumPage.match(/albumTitle=\{album\.title\}/g) ?? []).length, 2);
  assert.equal((albumPage.match(/YouTube Music ou Deezer/g) ?? []).length, 2);
});