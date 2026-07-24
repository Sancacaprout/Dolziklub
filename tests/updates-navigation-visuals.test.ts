import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const header = readFileSync(new URL("../src/components/site-header.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/mises-a-jour/page.tsx", import.meta.url), "utf8");
const board = readFileSync(new URL("../src/components/updates-board.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("updates are a first-class destination in the main navigation", () => {
  assert.match(header, /\["Mises \\u\{00E0\} jour", "\/mises-a-jour"\]/);
  assert.match(page, /className="updates-page__vinyl" aria-hidden="true"/);
});

test("update filters and sections use clear visual emoji cues", () => {
  assert.match(board, /\\u\{1F4DA\} Tout/);
  assert.match(board, /\\u\{2728\} Nouveautés/);
  assert.match(board, /\\u\{1F6E0\}\\u\{FE0F\} Corrections/);
  assert.match(board, /\\u\{1F680\} Améliorations/);
});

test("the masthead vinyl has grooves, a red label and a spindle hole", () => {
  assert.match(css, /\.updates-page__vinyl \{[^}]*repeating-radial-gradient/);
  assert.match(css, /\.updates-page__vinyl::before \{[^}]*background:var\(--red\)/);
  assert.match(css, /\.updates-page__vinyl::after \{[^}]*background:var\(--paper\)/);
});
