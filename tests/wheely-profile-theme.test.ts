import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  isProfileThemeId,
  profileThemes,
  wheelyThemeAssets,
} from "../src/lib/profile-themes";

const styles = readFileSync(resolve("src/app/globals.css"), "utf8");
const art = readFileSync(resolve("src/components/wheely-theme-art.tsx"), "utf8");
const boundary = readFileSync(resolve("src/components/profile-theme-boundary.tsx"), "utf8");
const preview = readFileSync(resolve("src/components/profile-theme-preview.tsx"), "utf8");
const editor = readFileSync(
  resolve("src/components/auth/profile-personalization.tsx"),
  "utf8",
);
const game = readFileSync(resolve("src/components/hero-vinyl-game.tsx"), "utf8");

test("Wheely owns an explicit and reusable set of real game assets", () => {
  const wheely = profileThemes.find((theme) => theme.id === "wheely");
  const assetPaths = [
    wheelyThemeAssets.character,
    ...wheelyThemeAssets.obstacles.map((obstacle) => obstacle.src),
  ];

  assert.equal(isProfileThemeId("wheely"), true);
  assert.equal(wheely?.artPath, wheelyThemeAssets.character);
  assert.equal(wheely?.previewVariant, "wheely");
  assert.deepEqual(assetPaths, [
    "/game/character/wheely.png",
    "/game/obstacles/blocker-a.png",
    "/game/obstacles/blocker-b.png",
    "/game/obstacles/low-barrier.png",
    "/game/obstacles/overhead-barrier.png",
  ]);
  for (const path of assetPaths) {
    assert.equal(existsSync(resolve("public", path.slice(1))), true, path);
  }
  assert.match(art, /wheelyThemeAssets\.obstacles\.map/);
  assert.match(art, /wheelyThemeAssets\.character/);
  for (const path of assetPaths.slice(1)) assert.ok(game.includes(path));
});

test("Wheely art is mounted only by the Wheely theme id", () => {
  assert.match(boundary, /effectiveTheme === "wheely" \? <WheelyThemeArt/);
  assert.match(
    editor,
    /theme\.id === "wheely" && theme\.previewVariant === "wheely"/,
  );
  assert.match(
    preview,
    /item\.id === "wheely" && item\.previewVariant === "wheely"/,
  );
  assert.equal(
    profileThemes
      .filter((theme) => theme.id !== "wheely")
      .some((theme) => theme.previewVariant === "wheely"),
    false,
  );
});

test("Wheely selectors cannot leak from the themed body into sibling previews", () => {
  assert.match(
    styles,
    /\.theme-card\[data-profile-theme="wheely"\] \.theme-card__mini/,
  );
  assert.match(
    styles,
    /\.profile-theme-preview\[data-profile-theme="wheely"\]/,
  );
  assert.match(
    styles,
    /\.profile-theme--full-page\[data-profile-theme="wheely"\]/,
  );
  assert.doesNotMatch(
    styles,
    /(?:^|\n)\[data-profile-theme="wheely"\] \.theme-card__mini/m,
  );
  assert.doesNotMatch(
    styles,
    /(?:^|\n)\[data-profile-theme="wheely"\] \.theme-card__preview/m,
  );
  assert.doesNotMatch(
    styles,
    /(?:^|\n)\[data-profile-theme="wheely"\] \.profile-theme-preview/m,
  );
});

test("Wheely has a responsive runner stage, arcade HUD and loadout cards", () => {
  assert.match(styles, /wheely-theme-art--profile/);
  assert.match(styles, /wheely-theme-art__hud/);
  assert.match(styles, /VINYL RUNNER · 3 LANES · ENDLESS MIX/);
  assert.match(styles, /LOADOUT MUSICAL · 3 SLOTS ÉQUIPÉS/);
  assert.match(styles, /@media \(max-width:700px\)/);
  assert.match(styles, /@media \(max-width:430px\)/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});
