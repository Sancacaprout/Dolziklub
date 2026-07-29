import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  cloneProfileCustomTheme,
  compileProfileCustomTheme,
  referencedProfileThemeAssetIds,
  sanitizeProfileThemeAssetMap,
} from "../src/lib/profile-custom-theme";

const routeSource = readFileSync(
  new URL("../src/app/api/profile-theme/assets/route.ts", import.meta.url),
  "utf8",
);
const migrationSource = readFileSync(
  new URL("../supabase/migrations/20260729182644_profile_custom_theme_assets.sql", import.meta.url),
  "utf8",
);
const decorationsSource = readFileSync(
  new URL("../src/components/profile-custom-theme-decorations.tsx", import.meta.url),
  "utf8",
);
const editorAssetsSource = readFileSync(
  new URL("../src/components/auth/custom-theme-editor/custom-theme-assets.tsx", import.meta.url),
  "utf8",
);

const assetId = "123e4567-e89b-42d3-a456-426614174000";

test("signed preview asset maps only accept the configured private Supabase bucket", () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  try {
    const signed = `https://project.supabase.co/storage/v1/object/sign/profile-theme-assets/member/${assetId}.webp?token=signed`;
    assert.deepEqual(sanitizeProfileThemeAssetMap({ [assetId]: signed }), { [assetId]: signed });
    assert.equal(sanitizeProfileThemeAssetMap({ [assetId]: "https://attacker.test/payload.webp?token=x" }), null);
    assert.equal(sanitizeProfileThemeAssetMap({ [assetId]: "javascript:alert(1)" }), null);
    assert.equal(sanitizeProfileThemeAssetMap({ [assetId]: "https://project.supabase.co/storage/v1/object/public/profile-theme-assets/x.webp?token=x" }), null);
    assert.equal(sanitizeProfileThemeAssetMap(Object.fromEntries(Array.from({ length: 10 }, (_, index) => [
      `123e4567-e89b-42d3-a456-42661417400${index}`,
      signed,
    ]))), null);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  }
});

test("the compiler only resolves referenced server-provided asset ids", () => {
  const config = cloneProfileCustomTheme();
  config.backgrounds.mode = "image";
  config.backgrounds.image.assetId = assetId;
  config.decorations = [{
    id: "223e4567-e89b-42d3-a456-426614174000",
    assetId,
    slot: "page-top-left",
    size: 100,
    opacity: 1,
    rotation: 0,
    mirror: false,
    visibility: "all",
    alt: "",
  }];
  assert.deepEqual(referencedProfileThemeAssetIds(config), [assetId]);
  assert.equal(compileProfileCustomTheme(config).style["--profile-custom-background-image"], "none");
  assert.match(String(compileProfileCustomTheme(config, { [assetId]: "https://signed.test/a.webp" }).style["--profile-custom-background-image"]), /^url\(/);
});

test("the upload API is a gated Node function that decodes and rewrites images with Sharp", () => {
  assert.match(routeSource, /export const runtime = "nodejs"/);
  assert.match(routeSource, /isProfileCustomThemeEditorEnabled\(\)/);
  assert.match(routeSource, /sharp\(bytes/);
  assert.match(routeSource, /limitInputPixels: PROFILE_THEME_ASSET_MAX_PIXELS/);
  assert.match(routeSource, /\.rotate\(\)/);
  assert.match(routeSource, /\.resize\(PROFILE_THEME_ASSET_MAX_DIMENSION/);
  assert.match(routeSource, /\.webp\(/);
  assert.match(routeSource, /metadata\.format !== expectedFormat/);
  assert.doesNotMatch(routeSource, /SUPABASE_SERVICE_ROLE_KEY|getSupabaseAdmin/);
  assert.doesNotMatch(routeSource, /runtime = "edge"/);
});

test("asset RLS binds metadata and storage paths to auth.uid", () => {
  assert.match(migrationSource, /participant_id uuid not null references public\.member_public_profiles\(id\)/);
  assert.match(migrationSource, /participant_id = \(select auth\.uid\(\)\)/);
  assert.match(migrationSource, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
  assert.match(migrationSource, /public, file_size_limit, allowed_mime_types/);
  assert.match(migrationSource, /false,\s*1536000,\s*array\['image\/webp'\][\s\S]*?\)/);
  assert.match(migrationSource, /revoke all on table public\.profile_custom_theme_assets from anon/);
  assert.doesNotMatch(migrationSource, /for update/);
});

test("decorations stay inside fixed site-owned slots and the editor caps them at eight", () => {
  assert.match(decorationsSource, /data-decoration-slot=\{decoration\.slot\}/);
  assert.match(decorationsSource, /aria-hidden="true"/);
  assert.doesNotMatch(decorationsSource, /decoration\.(top|left|right|bottom|x|y|zIndex)/);
  assert.match(editorAssetsSource, /CUSTOM_THEME_MAX_DECORATIONS/);
  assert.match(editorAssetsSource, /customThemeDecorationSlots/);
  assert.match(editorAssetsSource, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(editorAssetsSource, /storage\.from|\.insert\(|\.update\(|\.upsert\(/);
});
