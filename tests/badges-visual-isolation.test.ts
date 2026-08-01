import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("src/app/badges.css", "utf8");
const queue = readFileSync("src/components/badge-unlock-queue.tsx", "utf8");

test("badge collection keeps readable functional surfaces across profile themes", () => {
  assert.match(css, /\.badge-collection\{--badge-ui-ink:[\s\S]*color:var\(--badge-ui-ink\)!important/);
  assert.match(css, /\.badge-card\.is-locked\{opacity:1/);
  assert.match(css, /\.badge-card__copy p\{color:#36332e!important/);
  assert.match(css, /--badge-ui-accent:var\(--profile-accent/);
});

test("badge reveal is isolated from theme heading and button rules", () => {
  assert.match(css, /\.badge-reveal__card\{display:flex;[\s\S]*background:var\(--badge-dialog-paper\)!important/);
  assert.match(css, /\.badge-reveal__card h2\{[\s\S]*font:500 clamp/);
  assert.match(css, /@media\(max-height:720px\)/);
});

test("badge claiming reports recoverable RPC errors", () => {
  assert.match(queue, /setClaimError\("Le badge n’a pas pu être récupéré/);
  assert.match(queue, /className="badge-reveal__error" role="alert"/);
});
