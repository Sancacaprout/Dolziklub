import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gallerySource = readFileSync("src/components/meme-gallery.tsx", "utf8");
const cssSource = readFileSync("src/app/globals.css", "utf8");

test("offers Imgflip beside the existing meme upload action", () => {
  assert.match(gallerySource, /<div className="meme-gallery-actions">[\s\S]*<a className="button meme-create-button" href="https:\/\/imgflip\.com\/memetemplates" target="_blank" rel="noopener noreferrer">Créer un mème<\/a>[\s\S]*meme-add-button/);
  assert.match(gallerySource, /"Ajouter un mème ↗"/);
});

test("keeps the two meme actions distinct and responsive", () => {
  assert.match(cssSource, /\.meme-create-button \{[^}]*background:var\(--paper\)[^}]*box-shadow:5px 5px 0 var\(--red\)/);
  assert.match(cssSource, /\.meme-create-button:focus-visible/);
  assert.match(cssSource, /@media \(max-width:700px\)[\s\S]*\.meme-add-button,\.meme-create-button \{ width:100%; text-align:center; \}/);
});
