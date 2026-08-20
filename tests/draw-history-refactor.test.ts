import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260802074957_refactor_draw_history_badges_and_global_verdicts.sql", "utf8");
const liveAlbums = readFileSync("src/lib/live-albums.ts", "utf8");
const albumPage = readFileSync("src/app/albums/[slug]/page.tsx", "utf8");
const profilePage = readFileSync("src/app/membres/[slug]/page.tsx", "utf8");
const tableur = readFileSync("src/components/tableur-board.tsx", "utf8");

test("backfills draws one through five idempotently with stable identities", () => {
  for (let draw = 1; draw <= 5; draw += 1) assert.match(migration, new RegExp(`\\(\\d+, ${draw}, \\d+,`));
  assert.match(migration, /on conflict \(draw_number, position\) do update/);
  assert.match(migration, /case lower\(seed\.proposer_username\) when 'toma' then 'thomas'/);
  assert.match(migration, /historical_source.*static-archive-v1/s);
  assert.match(migration, /source_archive_album_id/);
  assert.match(migration, /admin_recalculate_all_badges/);
  assert.match(migration, /badge_recalculation_log/);
});

test("loads global album pages with every independent verdict", () => {
  assert.match(liveAlbums, /if \(isGlobal\)/);
  assert.match(liveAlbums, /eq\("draw_number", entry\.draw_number\)/);
  assert.match(liveAlbums, /reviewer_display_name/);
  assert.match(liveAlbums, /submittedAt/);
  assert.match(albumPage, /album\.globalReviews\?\.length/);
  assert.match(albumPage, /globalReview\.reviewerAvatarPath/);
  assert.match(albumPage, /globalReview\.submittedAt/);
  assert.match(albumPage, /\(Global\)/);
});

test("sorts draw lists newest first and labels global profile occurrences", () => {
  assert.match(tableur, /order\("draw_number", \{ ascending: false \}\)/);
  assert.match(profilePage, /album\.drawType === "global" \? "Tirage global"/);
  assert.match(profilePage, /\(Global\)/);
});

test("publishes public review identity without exposing direct review writes", () => {
  assert.match(migration, /reviewer_id uuid.*reviewer_avatar_path text/s);
  assert.match(migration, /security definer set search_path = '' stable/);
  assert.match(migration, /revoke all on function public\.get_public_draw_reviews\(\) from public/);
  assert.match(migration, /grant execute on function public\.get_public_draw_reviews\(\) to anon, authenticated/);
});
