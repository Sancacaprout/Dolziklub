import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bonusWorkspace = readFileSync("src/components/bonus-review-workspace.tsx", "utf8");
const extraWorkspace = readFileSync("src/components/extra-listenings.tsx", "utf8");
const collapseStyles = readFileSync("src/components/collapsible-workspace.module.css", "utf8");
const updates = readFileSync("src/data/site-updates.ts", "utf8");

test("bonus and extra listening workspaces can collapse without losing their state", () => {
  for (const source of [bonusWorkspace, extraWorkspace]) {
    assert.match(source, /const \[collapsed, setCollapsed\] = useState\(false\)/);
    assert.match(source, /aria-expanded=\{!collapsed\}/);
    assert.match(source, /onClick=\{\(\) => setCollapsed\(\(current\) => !current\)\}/);
    assert.match(source, /hidden=\{collapsed\}/);
    assert.match(source, /collapsed \? "Déplier" : "Réduire"/);
  }
  assert.match(bonusWorkspace, /aria-controls="bonus-review-workspace-content"/);
  assert.match(extraWorkspace, /aria-controls="extra-listening-workspace-content"/);
  assert.match(extraWorkspace, /collapseStyles\.compactHeader/);
});

test("the compact controls remain touch-friendly and are recorded in update 2.8", () => {
  assert.match(collapseStyles, /\.collapseButton \{[\s\S]*min-height: 44px/);
  assert.match(collapseStyles, /\.content\[hidden\] \{[\s\S]*display: none/);
  assert.match(collapseStyles, /@media \(max-width: 700px\)[\s\S]*width: 100%/);
  assert.match(updates, /id: "collapsible-listening-workspaces"/);
  assert.match(updates, /version: "2\.8"/);
  assert.match(updates, /date: "2026-07-29"/);
});
