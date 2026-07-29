import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { siteUpdates } from "../src/data/site-updates";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const styles = readFileSync("src/app/sheet-bonus-reviews.css", "utf8");
const liveDraws = readFileSync("src/components/live-draws.tsx", "utf8");
const tableur = readFileSync("src/components/tableur-board.tsx", "utf8");

test("bonus reviews keep their verdict readable instead of forcing it into columns", () => {
  assert.match(layout, /import "\.\/sheet-bonus-reviews\.css";/);
  for (const source of [liveDraws, tableur]) {
    assert.match(source, /className="sheet-bonus-reviews__meta"/);
    assert.match(source, /<section className="sheet-bonus-reviews__content"><ReviewPreview/);
  }
  assert.match(styles, /\.sheet-bonus-reviews__meta \{[^}]*display: flex;/s);
  assert.match(styles, /\.sheet-bonus-reviews__content \.review-preview \{[^}]*display: grid;/s);
  assert.match(styles, /justify-content: stretch;/);
  assert.match(styles, /overflow-wrap: anywhere;/);
});

test("bonus reviews fit narrow album cells and record the responsive fix", () => {
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.sheet-bonus-reviews article,[\s\S]*\.sheet-bonus-reviews__content,[\s\S]*min-width: 0;/);
  const update = siteUpdates.find((item) => item.id === "bonus-reviews-responsive-layout");
  assert.equal(update?.version, "2.10");
  assert.equal(update?.date, "2026-07-29");
});
