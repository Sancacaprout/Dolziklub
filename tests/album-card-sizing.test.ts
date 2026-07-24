import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cardSource = readFileSync("src/components/album-card.tsx", "utf8");
const albumsPageSource = readFileSync("src/app/albums/page.tsx", "utf8");
const cssSource = readFileSync("src/app/globals.css", "utf8");

test("gives shared album cards larger responsive image dimensions", () => {
  assert.match(cardSource, /compact \? "110px" : "\(max-width: 700px\) calc\(100vw - 2rem\), \(max-width: 1100px\) 48vw, 460px"/);
  assert.match(cardSource, /const href = `\/albums\/\$\{album\.slug\}`/);
  assert.match(cardSource, /getArchiveCoverFallback\(album\.id\) \?\? "\/album-a-venir\.png"/);
});

test("uses large desktop, two-column tablet and one-column mobile grids", () => {
  assert.match(albumsPageSource, /<main className="page albums-page">/);
  assert.match(cssSource, /\.albums-page \{ width:min\(1440px,calc\(100% - 3rem\)\); \}/);
  assert.match(cssSource, /\.album-grid \{ width:100%; grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(cssSource, /@media \(max-width:1100px\)[\s\S]*\.album-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(cssSource, /@media \(max-width:700px\)[\s\S]*\.album-grid \{ grid-template-columns:minmax\(0,1fr\)/);
});

test("does not enlarge list, compact or profile-favorite card variants", () => {
  assert.match(cssSource, /\.album-grid>\.album-card:not\(\.album-card--compact\)/);
  assert.match(cssSource, /\.album-card--list \{/);
  assert.doesNotMatch(cssSource, /Album cards[^]*profile-favorite-card__cover/);
});
