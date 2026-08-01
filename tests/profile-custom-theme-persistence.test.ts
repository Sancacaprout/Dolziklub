import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultProfileCustomTheme, validateProfileCustomThemeConfig } from "../src/lib/profile-custom-theme/index.ts";

const migration = readFileSync(
  new URL("../supabase/migrations/20260729195758_profile_custom_theme_publication_workflow.sql", import.meta.url),
  "utf8",
);
const hardeningMigration = readFileSync(
  new URL("../supabase/migrations/20260729203013_harden_custom_theme_asset_policies.sql", import.meta.url),
  "utf8",
);
const revisionMigration = readFileSync(
  new URL("../supabase/migrations/20260729203517_keep_custom_theme_revisions_monotonic.sql", import.meta.url),
  "utf8",
);
const sectionV2Migration = readFileSync(
  new URL("../supabase/migrations/20260801112354_profile_custom_theme_sections_v2.sql", import.meta.url),
  "utf8",
);
const v2CompatibilityMigration = readFileSync(
  new URL("../supabase/migrations/20260801181430_profile_custom_theme_v2_publish_reset_compatibility.sql", import.meta.url),
  "utf8",
);
const draftRoute = readFileSync(
  new URL("../src/app/api/profile-theme/draft/route.ts", import.meta.url),
  "utf8",
);
const publishRoute = readFileSync(
  new URL("../src/app/api/profile-theme/publish/route.ts", import.meta.url),
  "utf8",
);
const persistence = readFileSync(
  new URL("../src/components/auth/custom-theme-editor/custom-theme-persistence.tsx", import.meta.url),
  "utf8",
);
const serverTheme = readFileSync(
  new URL("../src/lib/profile-theme-server.ts", import.meta.url),
  "utf8",
);
test("the database default is the exact validated TypeScript default", () => {
  const fixture = migration.match(
    /create or replace function public\.profile_custom_theme_default_v1\(\)[\s\S]*?select \$json\$([\s\S]*?)\$json\$::jsonb;/,
  );
  assert.ok(fixture?.[1], "SQL default fixture missing");
  const sqlDefault = JSON.parse(fixture[1]);
  assert.deepEqual(sqlDefault, defaultProfileCustomTheme);
  assert.equal(validateProfileCustomThemeConfig(sqlDefault).ok, true);
});


test("pg_jsonschema validates drafts and publications with migration self-tests", () => {
  assert.match(migration, /create extension if not exists pg_jsonschema with schema extensions/);
  assert.match(migration, /extensions\.jsonb_matches_schema\(public\.profile_custom_theme_schema_v1\(\), config\)/g);
  assert.match(migration, /additionalProperties": false/);
  assert.match(migration, /pg_jsonschema rejected the valid custom theme fixture/);
  assert.match(migration, /accepted an unknown CSS field/);
  assert.match(migration, /accepted an external asset URL/);
  assert.match(migration, /octet_length\(config::text\) <= 65536/);
});

test("drafts stay owner-only while publications and referenced assets are public", () => {
  assert.match(migration, /create table public\.profile_custom_theme_drafts/);
  assert.match(migration, /create table public\.profile_custom_theme_publications/);
  assert.match(migration, /participant_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /Published custom themes are public[\s\S]*using \(true\)/);
  assert.match(migration, /Published custom theme assets are publicly readable/);
  assert.match(migration, /not public\.profile_custom_theme_asset_is_referenced/);
  assert.match(migration, /drop policy if exists "profile theme asset owners can delete metadata"/);
  assert.match(migration, /drop policy if exists "profile theme asset owners can delete objects"/);
  assert.doesNotMatch(migration, /profile_custom_theme_asset_is_referenced\(uuid, uuid\)/);
  assert.match(migration, /profile_custom_theme_asset_is_referenced\(p_asset_id uuid\)[\s\S]*draft\.participant_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
});
test("asset lookup helpers stay invoker-safe with one read policy per role", () => {
  assert.match(hardeningMigration, /security invoker/g);
  assert.doesNotMatch(hardeningMigration, /security definer/);
  assert.match(hardeningMigration, /Members and visitors read allowed custom theme assets/);
  assert.match(hardeningMigration, /Members and visitors read allowed custom theme objects/);
});
test("draft revisions remain monotonic after a direct draft deletion", () => {
  assert.match(revisionMigration, /published_revision bigint/);
  assert.match(revisionMigration, /next_revision := coalesce\(published_revision, 0\) \+ 1/);
  assert.match(revisionMigration, /p_config is null/);
});

test("V2 drafts keep their schema version through publication and reset", () => {
  assert.match(sectionV2Migration, /schema_version in \(1, 2\)/);
  assert.match(sectionV2Migration, /config_version := \(p_config ->> 'schemaVersion'\)::smallint/);
  assert.match(v2CompatibilityMigration, /current_draft\.config, current_draft\.schema_version/);
  assert.match(v2CompatibilityMigration, /current_publication\.config, current_publication\.schema_version/);
  assert.match(v2CompatibilityMigration, /profile_custom_theme_config_is_valid\(current_draft\.config\)/);
  assert.match(v2CompatibilityMigration, /pg_advisory_xact_lock/g);
  assert.doesNotMatch(
    v2CompatibilityMigration,
    /current_(?:draft|publication)\.config, 1, current_(?:draft|publication)\.revision/,
  );
});



test("publication derives identity and assets transactionally without client writes", () => {
  assert.match(migration, /function public\.publish_my_profile_custom_theme\(expected_revision bigint\)/);
  assert.doesNotMatch(migration, /publish_my_profile_custom_theme\([^)]*participant_id/);
  assert.match(migration, /caller_id uuid := \(select auth\.uid\(\)\)/);
  assert.match(migration, /for update/);
  assert.match(migration, /asset\.participant_id = caller_id and asset\.id = any\(referenced_assets\)/);
  assert.match(migration, /set profile_theme = 'custom'/);
  assert.match(migration, /set search_path = ''/g);
  assert.match(migration, /custom_theme_published/);
});

test("the API validates revisions and the editor exposes all four publishing states", () => {
  assert.match(draftRoute, /validateProfileCustomThemeConfig/);
  assert.match(draftRoute, /status === 409|const status = conflictStatus/);
  assert.match(publishRoute, /publish_my_profile_custom_theme/);
  assert.match(persistence, /"never" \| "draft" \| "published" \| "changes"/);
  assert.match(persistence, /Enregistrer le brouillon/);
  assert.match(persistence, /Publier et activer/);
  assert.match(persistence, /Annuler les modifications/);
  assert.doesNotMatch(persistence, /setInterval|channel\(|postgres_changes/);
});

test("the public profile signs only the asset ids copied into the publication", () => {
  assert.match(serverTheme, /select\("config,asset_ids"\)/);
  assert.match(serverTheme, /createSignedUrls\(paths, PROFILE_THEME_ASSET_SIGNED_URL_TTL_SECONDS\)/);
  assert.match(serverTheme, /sanitizeProfileThemeAssetMap/);
});
