import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const albumPage = readFileSync("src/app/albums/[slug]/page.tsx", "utf8");
const albumLayout = readFileSync("src/app/albums/[slug]/layout.tsx", "utf8");
const albumVerdict = readFileSync("src/components/album-verdict.tsx", "utf8");

const liveDraws = readFileSync("src/components/live-draws.tsx", "utf8");
test("best and worst tracks expose the Deezer player with album-aware matching", () => {
  assert.match(albumPage, /AlbumVerdict/);
  assert.match(albumVerdict, /MusicTrackChoiceButton/);
  assert.match(albumVerdict, /albumTitle=\{albumTitle\}/);
  assert.match(albumVerdict, /YouTube Music/);
  assert.match(albumPage, /getArchivedReviewOverride/);
  assert.match(albumPage, /archivedReview\?\.is_modified/);
  assert.doesNotMatch(albumLayout, /ArchiveReviewSynchronizer/);
});
test("new draw tracks use the same Deezer or YouTube Music chooser", () => {
  assert.ok((liveDraws.match(/MusicTrackChoiceButton/g) ?? []).length >= 3);
  assert.match(liveDraws, /youtubeMusicSearchUrl\(review\.best_track, entry\.album_artist, entry\.album_title\)/);
  assert.match(liveDraws, /youtubeMusicSearchUrl\(review\.worst_track, entry\.album_artist, entry\.album_title\)/);
});
