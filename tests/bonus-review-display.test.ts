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
  assert.match(liveDraws, /className="sheet-bonus-reviews"[\s\S]*<ReviewPreview/);
  assert.match(tableur, /className="sheet-bonus-reviews"[\s\S]*<ReviewPreview/);
  assert.match(styles, /\.sheet-bonus-reviews article > \.review-preview \{[^}]*display: grid;/s);
  assert.match(styles, /justify-content: stretch;/);
  assert.match(styles, /overflow-wrap: anywhere;/);
});

test("bonus reviews fit narrow album cells and record the responsive fix", () => {
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.sheet-bonus-reviews article,[\s\S]*min-width: 0;/);
  assert.equal(siteUpdates[0].id, "bonus-reviews-responsive-layout");
  assert.equal(siteUpdates[0].version, "2.10");
  assert.equal(siteUpdates[0].date, "2026-07-29");
});
