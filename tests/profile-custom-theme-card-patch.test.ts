import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const layout = readFileSync(resolve("src/app/layout.tsx"), "utf8");
const styles = readFileSync(resolve("src/app/profile-theme-custom-card-patch.css"), "utf8");

test("the custom card visual patch loads after the shared theme cards", () => {
  const sharedStyles = layout.indexOf('import "./profile-themes-v2.css";');
  const patchStyles = layout.indexOf('import "./profile-theme-custom-card-patch.css";');
  assert.ok(sharedStyles >= 0);
  assert.ok(patchStyles > sharedStyles);
});

test("the custom card reads as a restrained design workbench", () => {
  assert.match(styles, /theme-card--custom \.theme-card__studio\{/);
  assert.match(styles, /background-size:12px 12px/);
  assert.match(styles, /theme-card__studio-canvas::before/);
  assert.match(styles, /theme-card__studio-layers::after/);
  assert.match(styles, /theme-card__studio-palette::before/);
  assert.match(styles, /theme-card__studio-palette::after/);
  assert.match(styles, /clip-path:polygon/);
});

test("the custom card patch preserves mobile and reduced-motion behavior", () => {
  assert.match(styles, /@media \(max-width:700px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /transition:none/);
  assert.doesNotMatch(styles, /grid-template-columns|\.theme-picker__grid|display:none/);
});
