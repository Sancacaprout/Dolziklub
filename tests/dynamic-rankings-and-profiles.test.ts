import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { members } from "../src/data/members";
import { getClubStats, getMemberStats } from "../src/lib/statistics";
import { usernameToInternalEmail } from "../src/lib/auth/username";
import type { Album } from "../src/types/album";

const source = (path: string) => readFileSync(resolve(path), "utf8");

const liveAlbums = source("src/lib/live-albums.ts");
const snapshot = source("src/lib/club-snapshot.ts");
const rankings = source("src/app/classements/page.tsx");
const membersPage = source("src/app/membres/page.tsx");
const memberPage = source("src/app/membres/[slug]/page.tsx");
const refresh = source("src/components/live-club-refresh.tsx");
const metrics = source("src/components/club-live-metrics.tsx");
const board = source("src/components/rankings-board.tsx");
const archivedSyncMigration = source("supabase/migrations/20260718163602_synchronize_archived_review_catalog.sql");

function album(overrides: Partial<Album>): Album {
  return {
    id: "test",
    slug: "test",
    title: "Test",
    artist: "Test",
    cover: null,
    releaseYear: null,
    origin: null,
    language: null,
    genres: [],
    projectType: null,
    proposedBy: null,
    listenedBy: null,
    rating: null,
    shortReview: null,
    detailedReview: null,
    bestTrack: { title: null, url: null },
    worstTrack: { title: null, url: null },
    albumUrl: null,
    artistDescription: null,
    albumDescription: null,
    status: "pending",
    ...overrides,
  };
}

test("the catalog overlays every published draw and keeps live-only albums", () => {
  assert.match(liveAlbums, /export async function getPublishedLiveAlbums/);
  assert.match(liveAlbums, /\.in\("draw_number", drawNumbers\)/);
  assert.match(liveAlbums, /synchronizedByArchiveId/);
  assert.match(liveAlbums, /liveOnlyAlbums/);
  assert.match(snapshot, /getSynchronizedAlbums\(\)/);
  assert.match(snapshot, /getLatestLiveAlbums\(24\)/);
});

test("archived verdict overrides update the shared catalog and refresh live pages", () => {
  assert.match(liveAlbums, /getArchivedReviewOverrides/);
  assert.match(liveAlbums, /applyArchivedReviewOverrides/);
  assert.match(liveAlbums, /archived_album_reviews/);
  assert.match(refresh, /archived_album_reviews/);
  assert.match(archivedSyncMigration, /is_modified = true/);
});

test("rankings and profiles share the same server snapshot", () => {
  for (const page of [rankings, membersPage, memberPage]) {
    assert.match(page, /export const dynamic = "force-dynamic"/);
    assert.match(page, /getClubSnapshot\(\)/);
    assert.match(page, /<LiveClubRefresh/);
  }
  assert.doesNotMatch(metrics, /get_public_club_draw_metrics/);
  assert.doesNotMatch(board, /get_public_member_draw_metrics/);
});

test("revalidates profile and ranking data after database changes", () => {
  assert.match(refresh, /club_draw_entries/);
  assert.match(refresh, /member_album_reviews/);
  assert.match(refresh, /member_public_profiles/);
  assert.doesNotMatch(refresh, /setInterval/);
  assert.match(refresh, /router\.refresh\(\)/);
});

test("zero and half-step verdicts are included in live statistics", () => {
  const catalog = [
    album({ id: "zero", rating: 0, status: "rated", proposedBy: "Toma", listenedBy: "Dod" }),
    album({ id: "half", rating: 3.5, status: "rated", proposedBy: "Pep", listenedBy: "Thomas" }),
  ];
  const club = getClubStats(catalog);
  assert.equal(club.rated, 2);
  assert.equal(club.averageRating, 1.75);
  assert.equal(club.distribution.find((item) => item.score === 3.5)?.count, 1);

  const toma = members.find((member) => member.slug === "toma");
  assert.ok(toma);
  const stats = getMemberStats(catalog, toma.slug);
  assert.equal(stats.proposed.length, 1);
  assert.equal(stats.listened.length, 1);
});

test("Axel is available to the club with an empty profile", () => {
  const axel = members.find((member) => member.slug === "axel");
  assert.ok(axel);
  assert.equal(axel.displayName, "Axel");
  assert.equal(axel.username, "axel");
  assert.equal(axel.role, "member");
  assert.equal(usernameToInternalEmail("Axel"), "axel@dolziklub.vercel.app");

  const stats = getMemberStats([], axel.slug);
  assert.equal(stats.proposed.length, 0);
  assert.equal(stats.listened.length, 0);
});

test("Nadia is available to the club with an empty profile", () => {
  const nadia = members.find((member) => member.slug === "nadia");
  assert.ok(nadia);
  assert.equal(nadia.displayName, "Nadia");
  assert.equal(nadia.username, "nadia");
  assert.equal(nadia.role, "member");
  assert.equal(usernameToInternalEmail("Nadia"), "nadia@dolziklub.vercel.app");

  const stats = getMemberStats([], nadia.slug);
  assert.equal(stats.proposed.length, 0);
  assert.equal(stats.listened.length, 0);
});

test("Tibo is available to the club with an empty profile", () => {
  const tibo = members.find((member) => member.slug === "tibo");
  assert.ok(tibo);
  assert.equal(tibo.displayName, "Tibo");
  assert.equal(tibo.username, "tibo");
  assert.equal(tibo.role, "member");
  assert.equal(usernameToInternalEmail("Tibo"), "tibo@dolziklub.vercel.app");

  const stats = getMemberStats([], tibo.slug);
  assert.equal(stats.proposed.length, 0);
  assert.equal(stats.listened.length, 0);
});
test("the rankings expose styles calculated from the synchronized catalog", () => {
  const catalog = [album({ id: "rap", genres: ["Rap", "Soul"] }), album({ id: "rap-2", genres: ["rap"] })];
  assert.deepEqual(getClubStats(catalog).styles, [{ name: "Rap", count: 2 }, { name: "Soul", count: 1 }]);
  assert.match(rankings, /const styles = stats\.styles\.map/);
  assert.match(rankings, /styles=\{styles\}/);
  assert.match(board, /Les styles les plus/);
});
