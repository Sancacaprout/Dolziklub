import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { siteUpdates } from "../src/data/site-updates";

const pageSource = readFileSync("src/app/mises-a-jour/page.tsx", "utf8");
const boardSource = readFileSync("src/components/updates-board.tsx", "utf8");
const footerSource = readFileSync("src/components/footer.tsx", "utf8");
const cssSource = readFileSync("src/app/globals.css", "utf8");

test("publishes an accessible updates route with the requested metadata", () => {
  assert.match(pageSource, /Mises à jour — DOL ZIKLUB/);
  assert.match(pageSource, /Les nouvelles fonctionnalités, corrections et améliorations de DOL ZIKLUB/);
  assert.match(pageSource, /JOURNAL DU CLUB/);
  assert.match(pageSource, /<UpdatesBoard updates=\{siteUpdates\}/);
  assert.match(footerSource, /href="\/mises-a-jour"/);
});

test("keeps deployed updates in strict reverse chronological order", () => {
  assert.ok(siteUpdates.length >= 3);
  for (let index = 1; index < siteUpdates.length; index += 1) {
    assert.ok(Date.parse(siteUpdates[index - 1].date) >= Date.parse(siteUpdates[index].date));
  }
  for (const update of siteUpdates) {
    assert.match(update.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(update.categories.length > 0);
    assert.ok(update.added.length + update.fixed.length + update.improved.length > 0);
    for (const link of update.links) assert.match(link.href, /^\//);
  }
});

test("offers simple keyboard-safe filters and semantic update cards", () => {
  assert.match(boardSource, /aria-label="Filtrer les mises à jour"/);
  assert.match(boardSource, /aria-pressed=\{filter === item\.id\}/);
  assert.match(boardSource, /<time dateTime=\{update\.date\}>/);
  assert.match(boardSource, /role="status" aria-live="polite"/);
  assert.match(boardSource, /kind="added"/);
  assert.match(boardSource, /kind="fixed"/);
  assert.match(boardSource, /kind="improved"/);
});

test("keeps the changelog readable and touch-friendly on mobile", () => {
  assert.match(cssSource, /\.updates-filter button \{[^}]*min-height:44px/);
  assert.match(cssSource, /@media \(max-width:700px\)[\s\S]*\.update-card \{ grid-template-columns:1fr/);
  assert.match(cssSource, /\.update-card__badges \{[^}]*flex-wrap:wrap/);
});
