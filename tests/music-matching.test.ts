import test from "node:test";
import assert from "node:assert/strict";
import { cacheKey, classifyConfidence, musicUrls, normalizeMusicText, scoreMusicCandidate } from "../src/lib/music-matching";

test("normalise accents, apostrophes et ponctuation sans effacer le texte utile", () => {
  assert.equal(normalizeMusicText("L’École du micro d'argent — Vol. 1"), "l ecole du micro d argent vol 1");
  assert.equal(cacheKey("album", "JOŸA", "Tayc"), "album:v2:joya|tayc");
});

test("favorise un album officiel plutôt qu'une réaction hors sujet", () => {
  const official = scoreMusicCandidate({ title: "Ipséité", artist: "Damso", candidateTitle: "Damso - Ipséité (Album)", candidateArtist: "Damso", channelTitle: "Damso", resourceType: "playlist", thumbnailUrl: "https://example.test/cover.jpg", itemCount: 14 });
  const reaction = scoreMusicCandidate({ title: "Ipséité", artist: "Damso", candidateTitle: "REACTION to Damso Ipséité", candidateArtist: "", channelTitle: "Someone", resourceType: "video" });
  assert.ok(official > reaction);
  assert.equal(classifyConfidence(official), "high");
});

test("retrouve un album avec son seul titre pour l’autocomplétion", () => {
  const score = scoreMusicCandidate({ title: "Currents", artist: "", candidateTitle: "Tame Impala - Currents", candidateArtist: "Tame Impala", channelTitle: "Tame Impala - Topic", resourceType: "playlist", thumbnailUrl: "https://example.test/currents.jpg", itemCount: 13 });
  assert.ok(score >= 57);
  assert.notEqual(classifyConfidence(score), "low");
});

test("construit les liens YouTube Music vérifiables et la recherche de secours", () => {
  assert.deepEqual(musicUrls("playlist", "OLAK5uy_k123", "Blonde Frank Ocean"), { youtubeMusicUrl: "https://music.youtube.com/playlist?list=OLAK5uy_k123", youtubeUrl: "https://www.youtube.com/playlist?list=OLAK5uy_k123" });
  assert.match(musicUrls("search", null, "Land Kekra").youtubeMusicUrl, /music\.youtube\.com\/search/);
});
