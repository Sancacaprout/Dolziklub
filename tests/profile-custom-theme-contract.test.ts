import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CUSTOM_THEME_MAX_BYTES,
  applyCustomThemeInspiration,
  autoFixCustomThemeContrast,
  cloneProfileCustomTheme,
  compileProfileCustomTheme,
  customThemeContrastRatio,
  customThemeInspirations,
  defaultProfileCustomTheme,
  profileCustomThemeByteLength,
  validateProfileCustomThemeConfig,
} from "../src/lib/profile-custom-theme";

const compilerSource = readFileSync(
  new URL("../src/lib/profile-custom-theme/compiler.ts", import.meta.url),
  "utf8",
);
const accountPage = readFileSync(new URL("../src/app/compte/page.tsx", import.meta.url), "utf8");

test("the default custom theme satisfies the strict V1 contract", () => {
  const validation = validateProfileCustomThemeConfig(defaultProfileCustomTheme);
  assert.equal(validation.ok, true);
  assert.ok(profileCustomThemeByteLength(defaultProfileCustomTheme) < CUSTOM_THEME_MAX_BYTES);
});

test("the validator rejects unknown, hostile and out-of-range values", () => {
  const unknown = { ...cloneProfileCustomTheme(), css: "body{display:none}" };
  assert.deepEqual(validateProfileCustomThemeConfig(unknown).errors, ["config"]);

  const externalUrl = cloneProfileCustomTheme();
  externalUrl.backgrounds.image.assetId = "https://example.com/payload.svg";
  assert.match(validateProfileCustomThemeConfig(externalUrl).errors.join(" "), /backgrounds\.image\.assetId/);

  const hiddenContent = cloneProfileCustomTheme();
  (hiddenContent as unknown as Record<string, unknown>).display = "none";
  assert.equal(validateProfileCustomThemeConfig(hiddenContent).ok, false);

  const hugeTitle = cloneProfileCustomTheme();
  hugeTitle.typography.display.size = 400;
  assert.match(validateProfileCustomThemeConfig(hugeTitle).errors.join(" "), /typography\.display\.size/);
});

test("the compiler only emits explicit visual variables and safe enum classes", () => {
  const compiled = compileProfileCustomTheme(defaultProfileCustomTheme);
  assert.equal(compiled.style["--profile-custom-page"], "#F5F1E8");
  assert.ok(compiled.classes.includes("profile-custom-bg-solid"));
  assert.doesNotMatch(Object.keys(compiled.style).join(" "), /--profile-custom-(?:display|visibility|order)\\b|grid-area|z-index/);
  assert.doesNotMatch(compilerSource, /innerHTML|cssText|eval\(|new Function/);
});

test("existing themes are independent token inspirations rather than CSS copies", () => {
  assert.equal(customThemeInspirations.length, 16);
  const source = cloneProfileCustomTheme();
  const inspired = applyCustomThemeInspiration("jazz-lounge", source);
  assert.notEqual(inspired, source);
  assert.equal(source.inspirationSourceThemeId, null);
  assert.equal(inspired.inspirationSourceThemeId, "jazz-lounge");
  inspired.colors.page = "#000000";
  assert.notEqual(source.colors.page, inspired.colors.page);
});

test("contrast correction remains optional and selects a readable text colour", () => {
  const unsafe = cloneProfileCustomTheme();
  unsafe.colors.page = "#FFFFFF";
  unsafe.colors.text = "#FFFFFF";
  const fixed = autoFixCustomThemeContrast(unsafe);
  assert.equal(unsafe.colors.text, "#FFFFFF");
  assert.ok(customThemeContrastRatio(fixed.colors.text, fixed.colors.page) >= 4.5);
});

test("the custom editor rollout is controlled by a server-only feature flag", () => {
  assert.match(accountPage, /isProfileCustomThemeEditorEnabled/);
  assert.match(accountPage, /customThemeEnabled=\{customThemeEnabled\}/);
  assert.doesNotMatch(accountPage, /NEXT_PUBLIC_PROFILE_CUSTOM_THEME/);
});
