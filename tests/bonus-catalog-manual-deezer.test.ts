import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isLikelyCatalogAlbumResult } from "../src/lib/music-matching";

const bonusWorkspace = readFileSync("src/components/bonus-review-workspace.tsx", "utf8");
const bonusMigration = readFileSync(
  "supabase/migrations/20260726085028_bonus_catalog_and_manual_deezer.sql",
  "utf8",
);
const musicAssist = readFileSync("src/components/music-assist.tsx", "utf8");
const musicServer = readFileSync("src/lib/music-server.ts", "utf8");
const albumRoute = readFileSync("src/app/api/music/search-albums/route.ts", "utf8");
const favoriteAlbums = readFileSync(
  "src/components/auth/favorite-albums-panel.tsx",
  "utf8",
);

test("bonus candidates come from every filled draw assignment without review gates", () => {
  const candidatesBlock = bonusWorkspace.slice(
    bonusWorkspace.indexOf("const candidates = useMemo"),
    bonusWorkspace.indexOf("const candidateMap = useMemo"),
  );

  assert.match(candidatesBlock, /const live = entries/);
  assert.match(candidatesBlock, /entry\.album_title\?\.trim\(\)/);
  assert.match(candidatesBlock, /entry\.album_artist\?\.trim\(\)/);
  assert.match(candidatesBlock, /!liveArchiveNumbers\.has\(number\)/);
  assert.doesNotMatch(candidatesBlock, /entry\.listened_by !== member\.id/);
  assert.doesNotMatch(candidatesBlock, /album\.rating != null/);
  assert.match(bonusWorkspace, /candidateOptionLabel\(candidate\)/);
});

test("the database accepts bonus reviews for unrated draw albums without changing RLS", () => {
  assert.match(bonusMigration, /from public\.club_draw_entries as entry/);
  assert.match(bonusMigration, /from public\.archived_album_reviews as archive_review/);
  assert.doesNotMatch(bonusMigration, /join public\.member_album_reviews/);
  assert.doesNotMatch(bonusMigration, /archive_review\.rating is not null/);
  assert.doesNotMatch(bonusMigration, /listened_by is distinct from/);
  assert.doesNotMatch(bonusMigration, /alter table|create policy|disable row level security/i);
  assert.match(
    bonusMigration,
    /revoke all on function public\.save_my_bonus_album_review[\s\S]*from public, anon/,
  );
  assert.match(
    bonusMigration,
    /grant execute on function public\.save_my_bonus_album_review[\s\S]*to authenticated/,
  );
});

test("album lookup sends no Deezer request while typing and searches once per click", () => {
  const lookup = musicAssist.slice(
    musicAssist.indexOf("export function AlbumLookup"),
    musicAssist.indexOf("export function DeezerTrackLookup"),
  );

  assert.doesNotMatch(lookup, /useEffect|setTimeout|automatic|search\(true\)/);
  assert.match(lookup, /const canSearch = Boolean\(title\.trim\(\) \|\| artist\.trim\(\)\)/);
  assert.match(lookup, /onClick=\{\(\) => void search\(\)\}/);
  assert.match(lookup, /\(result\.candidates \?\? \[\]\)\.slice\(0, 5\)/);
  assert.match(lookup, /Renseigne un titre ou un artiste avant de rechercher/);
  assert.match(lookup, /La recherche Deezer est temporairement indisponible/);
});

test("Deezer returns only ranked albums with a human confirmation and catalogue id", () => {
  assert.match(musicServer, /api\.deezer\.com\/search\/album/);
  assert.match(musicServer, /item\.type && item\.type !== "album"/);
  assert.match(musicServer, /popularityBoost/);
  assert.match(musicServer, /\.sort\(\(left, right\) => right\.score - left\.score\)/);
  assert.match(musicServer, /\.slice\(0, 5\)/);
  assert.match(musicServer, /externalUrl: item\.link/);
  assert.match(albumRoute, /if \(!title && !artist\)/);
  assert.match(musicAssist, /CHOISIR CET ALBUM/);
  assert.match(favoriteAlbums, /source_catalog_key: item\.sourceCatalogKey/);
});

test("catalog matching tolerates a close title and supports artist-only searches", () => {
  assert.equal(
    isLikelyCatalogAlbumResult({
      title: "Nevermindd",
      artist: "Nirvana",
      candidateTitle: "Nevermind",
      candidateArtist: "Nirvana",
    }),
    true,
  );
  assert.equal(
    isLikelyCatalogAlbumResult({
      title: "",
      artist: "Nirvana",
      candidateTitle: "In Utero",
      candidateArtist: "Nirvana",
    }),
    true,
  );
  assert.equal(
    isLikelyCatalogAlbumResult({
      title: "",
      artist: "",
      candidateTitle: "In Utero",
      candidateArtist: "Nirvana",
    }),
    false,
  );
});
