import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wheel = readFileSync("src/components/global-draw-wheel.tsx", "utf8");
const tableur = readFileSync("src/components/tableur-board.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

test("the global draw wheel records one selected proposer before the draw is created", () => {
  assert.match(tableur, /Math\.random\(\) \* globalOptions\.length/);
  assert.match(tableur, /setPendingGlobalDraw\(config\)/);
  assert.match(tableur, /p_global_proposer_username: globalProposer/);
});

test("each member gets one replay of the stored global draw result", () => {
  assert.match(tableur, /dolziklub:global-draw-reveal:/);
  assert.match(tableur, /window\.localStorage\.getItem/);
  assert.match(tableur, /GlobalDrawWheel/);
  assert.match(wheel, /targetRotation/);
  assert.match(styles, /prefers-reduced-motion/);
});
