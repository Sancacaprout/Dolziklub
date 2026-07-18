import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const appleIcon = readFileSync("src/app/apple-icon.tsx", "utf8");
const manifest = readFileSync("src/app/manifest.ts", "utf8");
const player = readFileSync("src/components/music-player.tsx", "utf8");
const deezerApi = readFileSync("src/app/api/music/deezer-track/route.ts", "utf8");
const game = readFileSync("src/components/hero-vinyl-game.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

test("publishes a Safari and Apple compatible site icon", () => {
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /themeColor: "#f5f1e8"/);
  assert.match(appleIcon, /ImageResponse/);
  assert.match(appleIcon, /width: 180, height: 180/);
  assert.match(manifest, /src: "\/icon\.svg"/);
  assert.match(manifest, /display: "standalone"/);
});

test("keeps Deezer usable when Safari cannot render the embedded widget", () => {
  assert.match(player, /allow="autoplay; encrypted-media; clipboard-write"/);
  assert.match(player, /loading="eager"/);
  assert.match(player, /referrerPolicy="strict-origin-when-cross-origin"/);
  assert.match(player, /Ouvrir directement dans Deezer/);
  assert.match(player, /target="_blank" rel="noopener noreferrer"/);
  assert.match(player, /type="range"/);
  assert.match(deezerApi, /preview/);
  assert.match(deezerApi, /https:\/\/www\.deezer\.com\/track\/\$\{match\.id\}/);
});

test("recovers from Safari audio and storage restrictions in Wheely", () => {
  assert.match(game, /soundNeedsGesture/);
  assert.match(game, /LANCER LE SON/);
  assert.match(game, /await audio\.play\(\)/);
  assert.match(game, /function readBestScore\(\)/);
  assert.match(game, /Safari can disable storage/);
  assert.ok(game.indexOf("<audio ref={audioRef}") < game.indexOf("{open ? <section"));
  assert.match(styles, /-webkit-backdrop-filter:blur\(4px\)/);
});