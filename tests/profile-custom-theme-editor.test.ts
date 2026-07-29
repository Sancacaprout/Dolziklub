import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CUSTOM_THEME_PREVIEW_READY,
  CUSTOM_THEME_PREVIEW_UPDATE,
  cloneProfileCustomTheme,
  createCustomThemePreviewReadyMessage,
  createCustomThemePreviewUpdateMessage,
  readTrustedCustomThemePreviewReady,
  readTrustedCustomThemePreviewUpdate,
} from "../src/lib/profile-custom-theme";

const editorSource = readFileSync(
  new URL("../src/components/auth/custom-theme-editor/custom-theme-editor.tsx", import.meta.url),
  "utf8",
);
const editorPageSource = readFileSync(
  new URL("../src/app/compte/theme-personnalise/page.tsx", import.meta.url),
  "utf8",
);
const memberPageSource = readFileSync(
  new URL("../src/app/membres/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const tutorialSource = readFileSync(
  new URL("../src/components/auth/custom-theme-editor/custom-theme-tutorial.tsx", import.meta.url),
  "utf8",
);
const customThemeStyles = readFileSync(
  new URL("../src/app/profile-custom-theme.css", import.meta.url),
  "utf8",
);

test("preview messages require the exact origin, window and session", () => {
  const source = {} as MessageEventSource;
  const otherSource = {} as MessageEventSource;
  const ready = createCustomThemePreviewReadyMessage("session-1");

  assert.equal(ready.type, CUSTOM_THEME_PREVIEW_READY);
  assert.ok(readTrustedCustomThemePreviewReady(
    { data: ready, origin: "https://dolziklub.test", source },
    { origin: "https://dolziklub.test", source, sessionId: "session-1" },
  ));
  assert.equal(readTrustedCustomThemePreviewReady(
    { data: ready, origin: "https://attacker.test", source },
    { origin: "https://dolziklub.test", source, sessionId: "session-1" },
  ), null);
  assert.equal(readTrustedCustomThemePreviewReady(
    { data: ready, origin: "https://dolziklub.test", source: otherSource },
    { origin: "https://dolziklub.test", source, sessionId: "session-1" },
  ), null);
  assert.equal(readTrustedCustomThemePreviewReady(
    { data: ready, origin: "https://dolziklub.test", source },
    { origin: "https://dolziklub.test", source, sessionId: "session-2" },
  ), null);
});

test("preview updates validate the complete theme contract before rendering", () => {
  const source = {} as MessageEventSource;
  const config = cloneProfileCustomTheme();
  config.colors.accent = "#ABCDEF";
  const update = createCustomThemePreviewUpdateMessage("session-1", config);

  assert.equal(update.type, CUSTOM_THEME_PREVIEW_UPDATE);
  assert.equal(readTrustedCustomThemePreviewUpdate(
    { data: update, origin: "https://dolziklub.test", source },
    { origin: "https://dolziklub.test", source, sessionId: "session-1" },
  )?.config.colors.accent, "#ABCDEF");

  const hostile = {
    ...update,
    config: { ...config, css: "body{display:none}" },
  };
  assert.equal(readTrustedCustomThemePreviewUpdate(
    { data: hostile, origin: "https://dolziklub.test", source },
    { origin: "https://dolziklub.test", source, sessionId: "session-1" },
  ), null);
});

test("the editor keeps changes local and caps undo history at fifty states", () => {
  assert.match(editorSource, /const MAX_HISTORY = 50/);
  assert.match(editorSource, /\.slice\(-MAX_HISTORY\)/);
  assert.match(editorSource, /target\.postMessage\([\s\S]*window\.location\.origin/);
  assert.doesNotMatch(editorSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|storage\./);
  assert.match(editorSource, /CustomThemePersistence/);
});

test("the editor route and iframe preview stay behind the server flag", () => {
  assert.match(editorPageSource, /isProfileCustomThemeEditorEnabled\(\)/);
  assert.match(editorPageSource, /notFound\(\)/);
  assert.match(editorSource, /previewTheme=custom&profilePreview=1&previewSession=/);
  assert.match(memberPageSource, /\^\[A-Za-z0-9_-\]\{1,100\}\$/);
});

test("phase two exposes the full color, typography and inspiration controls", () => {
  assert.match(editorSource, /customThemeInspirations\.map/);
  assert.match(editorSource, /customThemeTypographyRoles\.map/);
  assert.match(editorSource, /colorFields\.map/);
  assert.match(editorSource, /Ordinateur/);
  assert.match(editorSource, /Tablette/);
  assert.match(editorSource, /Mobile/);
});

test("editor polish keeps color picking stable and adds safe visual controls", () => {
  assert.match(editorSource, /onInput=\{\(event\) => setPickerDraft/);
  assert.match(editorSource, /onBlur=\{applyPicker\}/);
  assert.match(editorSource, /requestFullscreen\(\)/);
  assert.match(editorSource, /Coins des cartes et jaquettes/);
  assert.match(customThemeStyles, /border-radius: var\(--profile-custom-album-card-radius\)/);
  assert.match(customThemeStyles, /profile-custom-album-frame-line[\s\S]*box-shadow: none/);
});

test("the complete tutorial is skippable, relaunchable and keyboard friendly", () => {
  assert.match(tutorialSource, /const steps = \[[\s\S]*08 · FILET DE SÉCURITÉ/);
  assert.match(tutorialSource, /useSyncExternalStore/);
  assert.match(tutorialSource, /aria-modal="true"[\s\S]*event\.key === "Escape"[\s\S]*event\.key === "Tab"/);
});
