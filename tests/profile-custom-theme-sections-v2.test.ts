import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CUSTOM_THEME_PREVIEW_FOCUS,
  CUSTOM_THEME_PREVIEW_SECTION,
  cloneProfileCustomTheme,
  compileProfileCustomTheme,
  createCustomThemePreviewFocusMessage,
  createCustomThemePreviewSectionMessage,
  customThemeSectionIds,
  readTrustedCustomThemePreviewFocus,
  readTrustedCustomThemePreviewSection,
  upgradeProfileCustomThemeV1ToV2,
  validateProfileCustomThemeConfig,
} from "../src/lib/profile-custom-theme";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20260801112354_profile_custom_theme_sections_v2.sql");
const memberPage = read("../src/app/membres/[slug]/page.tsx");
const boundary = read("../src/components/profile-theme-boundary.tsx");
const editor = read("../src/components/auth/custom-theme-editor/custom-theme-editor.tsx");
const tutorial = read("../src/components/auth/custom-theme-editor/custom-theme-tutorial.tsx");
const styles = read("../src/app/profile-custom-theme.css");

test("V1 themes upgrade deterministically to the strict V2 section contract", () => {
  const legacy = cloneProfileCustomTheme();
  const upgraded = upgradeProfileCustomThemeV1ToV2(legacy);
  assert.equal(upgraded.schemaVersion, 2);
  assert.deepEqual(Object.keys(upgraded.sections), [...customThemeSectionIds]);
  assert.equal(validateProfileCustomThemeConfig(legacy).ok, true);
  assert.equal(validateProfileCustomThemeConfig(upgraded).ok, true);
  assert.equal(legacy.schemaVersion, 1);
  const hostile = structuredClone(upgraded) as unknown as Record<string, unknown>;
  const sections = hostile.sections as Record<string, Record<string, unknown>>;
  sections.identity.display = "none";
  assert.equal(validateProfileCustomThemeConfig(hostile).ok, false);
});

test("the compiler exposes only explicit per-section variables", () => {
  const upgraded = upgradeProfileCustomThemeV1ToV2(cloneProfileCustomTheme());
  upgraded.sections.favoriteAlbums.cover.radius = 19;
  const compiled = compileProfileCustomTheme(upgraded);
  assert.equal(compiled.sectionStyles.favoriteAlbums?.["--profile-section-cover-radius"], "19px");
  const emitted = Object.keys(compiled.sectionStyles.favoriteAlbums ?? {}).join(" ");
  assert.doesNotMatch(emitted, /(?:^|-)display(?:-|$)|(?:^|-)visibility(?:-|$)|(?:^|-)order(?:-|$)|grid-area|z-index/);
});

test("section preview messages require the expected origin, source and session", () => {
  const source = {} as MessageEventSource;
  const section = createCustomThemePreviewSectionMessage("s1", "favoriteAlbums", "select");
  const focus = createCustomThemePreviewFocusMessage("s1", "stats", true);
  assert.equal(section.type, CUSTOM_THEME_PREVIEW_SECTION);
  assert.equal(focus.type, CUSTOM_THEME_PREVIEW_FOCUS);
  assert.equal(readTrustedCustomThemePreviewSection(
    { data: section, origin: "https://dolziklub.test", source },
    { origin: "https://dolziklub.test", source, sessionId: "s1" },
  )?.sectionId, "favoriteAlbums");
  assert.equal(readTrustedCustomThemePreviewFocus(
    { data: focus, origin: "https://attacker.test", source },
    { origin: "https://dolziklub.test", source, sessionId: "s1" },
  ), null);
  assert.equal(readTrustedCustomThemePreviewSection(
    { data: { ...section, sectionId: "unknown" }, origin: "https://dolziklub.test", source },
    { origin: "https://dolziklub.test", source, sessionId: "s1" },
  ), null);
});

test("public section order remains owned by the member page", () => {
  const listened = memberPage.indexOf('data-profile-section="listened"');
  const proposed = memberPage.indexOf('data-profile-section="proposed"');
  assert.ok(listened >= 0 && proposed > listened);
  assert.match(boundary, /closest<HTMLElement>\("\[data-profile-section\]"\)/);
  assert.doesNotMatch(boundary, /appendChild|insertBefore|replaceChildren/);
});

test("the editor offers section navigation, live color preview and a guided spotlight", () => {
  assert.match(editor, /CustomThemeSectionNavigation/);
  assert.match(editor, /onInput=\{\(event\) => previewPicker/);
  assert.match(editor, /postPreview\(next, assetMap\)/);
  assert.match(editor, /data-tutorial-anchor="preview"/);
  assert.match(tutorial, /scrollIntoView/);
  assert.match(tutorial, /custom-theme-tutorial__spotlight/);
  assert.match(styles, /data-editor-selected="true"/);
});

test("the local migration accepts V1 and V2 without changing RLS", () => {
  assert.match(migration, /profile_custom_theme_schema_v2/);
  assert.match(migration, /profile_custom_theme_config_is_valid/);
  assert.match(migration, /schema_version in \(1, 2\)/);
  assert.match(migration, /config_version := \(p_config ->> 'schemaVersion'\)::smallint/);
  assert.match(migration, /profile_custom_theme_v1_regression/);
  assert.match(migration, /profile_custom_theme_v2_schema_rejected_valid_document/);
  assert.doesNotMatch(migration, /create policy|drop policy|enable row level security|disable row level security/i);
});
