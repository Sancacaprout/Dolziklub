import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const albumPage = readFileSync("src/app/albums/[slug]/page.tsx", "utf8");
const albumLayout = readFileSync("src/app/albums/[slug]/layout.tsx", "utf8");

const liveDraws = readFileSync("src/components/live-draws.tsx", "utf8");
test("best and worst tracks expose the Deezer player with album-aware matching", () => {
  assert.match(albumPage, /MusicTrackChoiceButton/);
  assert.equal((albumPage.match(/albumTitle=\{album\.title\}/g) ?? []).length, 2);
  assert.equal((albumPage.match(/\\u00C9couter sur YouTube Music/g) ?? []).length, 2);
  assert.match(albumPage, /getArchivedReviewOverride/);
  assert.match(albumPage, /archivedReview\?\.is_modified/);
  assert.doesNotMatch(albumLayout, /ArchiveReviewSynchronizer/);
});
test("new draw tracks use the same Deezer or YouTube Music chooser", () => {
  assert.ok((liveDraws.match(/MusicTrackChoiceButton/g) ?? []).length >= 3);
  assert.match(liveDraws, /youtubeMusicSearchUrl\(review\.best_track, entry\.album_artist, entry\.album_title\)/);
  assert.match(liveDraws, /youtubeMusicSearchUrl\(review\.worst_track, entry\.album_artist, entry\.album_title\)/);
});
