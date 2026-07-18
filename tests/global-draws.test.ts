import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getClubStats, getMemberStats } from "../src/lib/statistics";
import type { Album } from "../src/types/album";

const migration = readFileSync("supabase/migrations/20260716192909_add_global_club_draws.sql", "utf8");
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
    { entryId: "entry-dod", listenedBy: "Dod", rating: 4, shortReview: "Bien", detailedReview: null, bestTrack: { title: "A", url: null }, worstTrack: { title: "B", url: null } },
    { entryId: "entry-pep", listenedBy: "Pep", rating: null, shortReview: null, detailedReview: null, bestTrack: { title: null, url: null }, worstTrack: { title: null, url: null } },
  ],
};

test("creates a global draw with one proposer and one row per other participant", () => {
  assert.match(migration, /draw_type in \('standard', 'global'\)/);
  assert.match(migration, /listener\.id <> global_proposer\.id/);
  assert.match(migration, /cardinality\(draw\.participant_usernames\) - 1/);
  assert.match(migration, /club_draw_entries_sync_global_proposal/);
  assert.match(migration, /Choisis l’album du club/);
});

test("offers the global draw type and designated proposer in the tableur", () => {
  assert.match(tableur, /Écoute globale/);
  assert.match(tableur, /Qui choisit l’album commun/);
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