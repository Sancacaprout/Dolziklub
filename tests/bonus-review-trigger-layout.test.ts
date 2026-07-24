import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const boardSource = readFileSync("src/components/tableur-board.tsx", "utf8");
const workspaceSource = readFileSync(
  "src/components/bonus-review-workspace.tsx",
  "utf8",
);
const drawsSource = readFileSync("src/components/live-draws.tsx", "utf8");
const cssSource = readFileSync("src/app/globals.css", "utf8");

test("opens the persistent bonus workspace but requests scrolling only from the explicit action", () => {
  assert.match(
    boardSource,
    /const openBonusWorkspace = \(\) => \{[\s\S]*localStorage\.setItem\(bonusWorkspaceKey, "open"\);[\s\S]*setBonusOpen\(true\);[\s\S]*setBonusScrollRequest\(\(current\) => current \+ 1\);[\s\S]*setActiveTab\("selection"\);/,
  );
  assert.match(boardSource, /consumedBonusScrollRequest = useRef\(0\)/);
  assert.match(
    boardSource,
    /consumedBonusScrollRequest\.current >= bonusScrollRequest/,
  );
  assert.match(
    boardSource,
    /consumedBonusScrollRequest\.current = bonusScrollRequest/,
  );
  assert.match(
    boardSource,
    /\[activeTab, bonusOpen, bonusScrollRequest\]/,
  );
  assert.doesNotMatch(boardSource, /window\.setTimeout\([\s\S]{0,100}80/);
  assert.match(boardSource, />Écouter un album bonus<\/button>/);
  assert.match(
    boardSource,
    /bonusAction=\{member \? <aside className="bonus-review-callout"/,
  );
  assert.match(drawsSource, /draw\.status === "published" && bonusAction/);
});

test("does not reuse persistent visibility as a scroll request", () => {
  assert.match(
    boardSource,
    /localStorage\.getItem\(bonusWorkspaceKey\) === "open" \|\| hasOwnBonusReview\) setBonusOpen\(true\)/,
  );
  assert.doesNotMatch(
    boardSource,
    /useEffect\(\(\) => \{ if \(!bonusOpen \|\| activeTab !== "selection"\) return;/,
  );
});

test("renders an accessible bonus success banner and confirmed reset action", () => {
  assert.match(workspaceSource, /bonus-review-message/);
  assert.match(workspaceSource, /role="status"/);
  assert.match(workspaceSource, /aria-live="polite"/);
  assert.match(
    workspaceSource,
    /window\.confirm\([\s\S]{0,120}"Réinitialiser cet avis bonus/,
  );
  assert.match(cssSource, /\.bonus-review-message\.is-success/);
  assert.match(cssSource, /background:var\(--acid\)/);
  assert.match(
    cssSource,
    /\.bonus-review-workspace \.review-form__actions \.review-form__reset/,
  );
  assert.match(cssSource, /min-height:48px/);
  assert.match(cssSource, /button:focus-visible/);
  assert.match(
    cssSource,
    /@media \(max-width:700px\)[\s\S]*\.bonus-review-workspace \.review-form__actions/,
  );
});

test("keeps the bonus action understandable and responsive", () => {
  assert.match(
    boardSource,
    /Écoute et note l’album d’un autre membre\. Hors moyennes officielles\./,
  );
  assert.match(
    cssSource,
    /\.bonus-review-callout \{[^}]*border:1px solid var\(--ink\)[^}]*box-shadow:4px 4px 0 var\(--ink\)/,
  );
  assert.match(cssSource, /\.bonus-review-trigger:focus-visible/);
  assert.match(
    cssSource,
    /@media \(max-width:960px\)[\s\S]*\.bonus-review-callout \{ width:100%/,
  );
  assert.match(
    cssSource,
    /@media \(max-width:700px\)[\s\S]*\.bonus-review-trigger \{ width:100%/,
  );
});
