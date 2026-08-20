import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getClubStats, getMemberStats } from "../src/lib/statistics";
import type { Album } from "../src/types/album";

const migration = readFileSync("supabase/migrations/20260716192909_add_global_club_draws.sql", "utf8");
const proposerReviewPatch = readFileSync("supabase/migrations/20260820123025_allow_global_proposer_reviews_and_fix_wesleys_theory.sql", "utf8");
const reviewCards = readFileSync("src/components/music-selection-cards.tsx", "utf8");
const tableur = readFileSync("src/components/tableur-board.tsx", "utf8");
const liveAlbums = readFileSync("src/lib/live-albums.ts", "utf8");

const globalAlbum: Album = {
  id: "live-global",
  slug: "live-global",
  title: "Album commun",
  artist: "Artiste",
  cover: null,
  releaseYear: null,
  origin: null,
  language: null,
  genres: [],
  projectType: null,
  proposedBy: "Toma",
  listenedBy: null,
  rating: 4,
  shortReview: "1 verdict rendu sur 2.",
  detailedReview: null,
  bestTrack: { title: null, url: null },
  worstTrack: { title: null, url: null },
  albumUrl: null,
  artistDescription: null,
  albumDescription: null,
  status: "pending",
  drawNumber: 7,
  liveEntryId: "entry-dod",
  globalReviews: [
    { entryId: "entry-dod", listenedBy: "Dod", reviewerId: "id-dod", reviewerDisplayName: "Dod", reviewerAvatarPath: null, submittedAt: "2026-08-01T12:00:00Z", rating: 4, shortReview: "Bien", detailedReview: null, bestTrack: { title: "A", url: null }, worstTrack: { title: "B", url: null } },
    { entryId: "entry-pep", listenedBy: "Pep", reviewerId: "id-pep", reviewerDisplayName: "Pep", reviewerAvatarPath: null, submittedAt: null, rating: null, shortReview: null, detailedReview: null, bestTrack: { title: null, url: null }, worstTrack: { title: null, url: null } },
  ],
};

test("creates a global draw with one review row per participant, including the proposer", () => {
  assert.match(migration, /draw_type in \('standard', 'global'\)/);
  assert.doesNotMatch(proposerReviewPatch, /listener\.id <> global_proposer\.id/);
  assert.match(proposerReviewPatch, /row_count <> cardinality\(draw\.participant_usernames\)/);
  assert.match(proposerReviewPatch, /self_assignment_count <> 1/);
  assert.match(proposerReviewPatch, /listened_by = proposer\.id/);
  assert.match(proposerReviewPatch, /A member cannot propose and listen to the same album in a classic draw/);
  assert.match(migration, /club_draw_entries_sync_global_proposal/);
  assert.match(migration, /Choisis l’album du club/);
});

test("keeps one verdict per member and offers explicit track suggestions", () => {
  assert.match(proposerReviewPatch, /not exists \([\s\S]*existing\.listened_by = proposer\.id/);
  assert.match(proposerReviewPatch, /Wesley''s Theory/);
  assert.match(proposerReviewPatch, /weasley s theory/);
  assert.doesNotMatch(proposerReviewPatch, /set worst_track = 'Wesley/);
  assert.match(reviewCards, /<TrackLookup[\s\S]*label="Best track"/);
  assert.match(reviewCards, /<TrackLookup[\s\S]*label="Worst track"/);
});

test("counts the global proposer once as proposer and once as listener", () => {
  const albumWithSelfReview: Album = {
    ...globalAlbum,
    globalReviews: [
      ...(globalAlbum.globalReviews ?? []),
      { entryId: "entry-toma", listenedBy: "Toma", reviewerId: "id-toma", reviewerDisplayName: "Toma", reviewerAvatarPath: null, submittedAt: "2026-08-01T13:00:00Z", rating: 4.5, shortReview: "Mon verdict", detailedReview: null, bestTrack: { title: "A", url: null }, worstTrack: { title: "B", url: null } },
    ],
  };
  const proposer = getMemberStats([albumWithSelfReview], "toma");
  assert.equal(proposer.proposed.length, 1);
  assert.equal(proposer.listened.length, 1);
});

test("offers the global draw type and designated proposer in the tableur", () => {
  assert.match(tableur, /Écoute globale/);
  assert.match(tableur, /GlobalDrawWheel/);
  assert.match(tableur, /Math\.random\(\) \* globalOptions\.length/);
  assert.match(tableur, /p_global_proposer_username: globalProposer/);
  assert.match(tableur, /draw_type, global_proposer_username/);
  assert.match(liveAlbums, /collapseGlobalDrawAlbums/);
});

test("counts one global album while preserving every individual verdict", () => {
  const club = getClubStats([globalAlbum]);
  assert.equal(club.total, 1);
  assert.equal(club.rated, 1);
  assert.equal(club.pending, 1);
  assert.equal(club.averageRating, 4);
  assert.equal(club.completionRate, 50);

  const proposer = getMemberStats([globalAlbum], "toma");
  assert.equal(proposer.proposed.length, 1);
  assert.equal(proposer.receivedAverage, 4);

  const listener = getMemberStats([globalAlbum], "dod");
  assert.equal(listener.listened.length, 1);
  assert.equal(listener.listened[0]?.slug, "live-entry-dod");
  assert.equal(listener.givenAverage, 4);
});