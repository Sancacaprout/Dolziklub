import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cardSource = readFileSync("src/components/album-card.tsx", "utf8");
const albumsPageSource = readFileSync("src/app/albums/page.tsx", "utf8");
const cssSource = readFileSync("src/app/globals.css", "utf8");

test("restores the original catalogue card image dimensions", () => {
  assert.match(cardSource, /compact \? "110px" : "\(max-width: 700px\) 46vw, 260px"/);
  assert.match(cardSource, /const href = `\/albums\/\$\{album\.slug\}`/);
  assert.match(cardSource, /getArchiveCoverFallback\(album\.id\) \?\? "\/album-a-venir\.png"/);
});

test("restores the historical three-column desktop and two-column mobile catalogue", () => {
  assert.match(albumsPageSource, /<main className="page">/);
  assert.doesNotMatch(albumsPageSource, /albums-page/);
  assert.match(cssSource, /\.album-grid \{ display:grid; grid-template-columns:repeat\(3,1fr\)/);
  assert.match(cssSource, /@media \(max-width:700px\)[^}]*[\s\S]*?\.album-grid \{ grid-template-columns:repeat\(2,1fr\)/);
  assert.doesNotMatch(cssSource, /larger catalogue proportions/);
});

test("enlarges only the full descriptive album sheet", () => {
  assert.match(cssSource, /\.album-page \.album-sheet \{ grid-template-columns:minmax\(360px,\.82fr\) minmax\(0,1\.18fr\)/);
  assert.match(cssSource, /\.album-page \.album-sheet__cover \{ width:min\(100%,560px\)/);
  assert.match(cssSource, /\.album-page \.album-sheet__cover \{ max-width:min\(100%,440px\); \}/);
  assert.match(cssSource, /\.album-card--list \{/);
});
