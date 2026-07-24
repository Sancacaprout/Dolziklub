import assert from "node:assert/strict";
import test from "node:test";
import {
  parseYouTubeVideoId,
  youtubePrivacyEmbedUrl,
  youtubeWatchUrl,
} from "../src/lib/youtube-video";

const videoId = "dQw4w9WgXcQ";

test("normalizes supported YouTube links to a video id", () => {
  const urls = [
    "https://www.youtube.com/watch?v=" + videoId,
    "https://www.youtube.com/watch?v=" + videoId + "&list=anything&t=12",
    "https://youtu.be/" + videoId + "?si=share",
    "https://www.youtube.com/shorts/" + videoId + "?feature=share",
    "https://music.youtube.com/watch?v=" + videoId + "&list=RDAMVM",
    "https://m.youtube.com/watch?v=" + videoId,
  ];
  for (const url of urls) assert.equal(parseYouTubeVideoId(url), videoId);
});

test("rejects non-YouTube hosts, scripts and invalid ids", () => {
  const invalid = [
    "javascript:alert(1)",
    "https://example.com/watch?v=" + videoId,
    "https://youtube.com.evil.example/watch?v=" + videoId,
    "https://www.youtube.com/watch?v=too-short",
    "<iframe src=\"https://youtube.com\"></iframe>",
    "https://www.youtube.com/playlist?list=abc",
  ];
  for (const url of invalid) assert.equal(parseYouTubeVideoId(url), null);
});

test("builds controlled privacy and watch URLs only from valid ids", () => {
  assert.equal(youtubePrivacyEmbedUrl(videoId), "https://www.youtube-nocookie.com/embed/" + videoId);
  assert.equal(youtubeWatchUrl(videoId), "https://www.youtube.com/watch?v=" + videoId);
  assert.throws(() => youtubePrivacyEmbedUrl("invalid"));
});
