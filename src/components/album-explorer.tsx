"use client";

import { useEffect, useMemo, useState } from "react";
import { AlbumCard } from "@/components/album-card";
import { getMemberDisplayName, members } from "@/data/members";
import { normalizeMusicText } from "@/lib/music-matching";
import { resolvedArchiveNumber } from "@/lib/archive-number-fallbacks";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type { Album } from "@/types/album";

type DrawStatus = "draft" | "published" | "locked";

type LiveEntry = {
  id: string;
  draw_number: number;
  position: number;
  proposed_by_name: string | null;
  listened_by_name: string | null;
  album_title: string | null;
  album_artist: string | null;
  cover_path: string | null;
  cover_source_url: string | null;
  youtube_music_url: string | null;
  draw_status: DrawStatus;
  updated_at: string;
  archive_number: number | null;
};
const memberName = (value: string | null) =>
  getMemberDisplayName(value).toLocaleLowerCase("fr");

function archiveNumber(album: Album) {
  return resolvedArchiveNumber(album) ?? 0;
}

function coverUrl(path: string | null, sourceUrl: string | null) {
  return path
    ? getSupabaseBrowserClient().storage.from("album-covers").getPublicUrl(path)
        .data.publicUrl
    : sourceUrl ?? "/album-a-venir.png";
}
function liveAlbum(entry: LiveEntry): Album {
  return {
    id: `live-${entry.id}`,
    slug: `live-${entry.id}`,
    title: entry.album_title!,
    artist: entry.album_artist!,
    cover: coverUrl(entry.cover_path, entry.cover_source_url),
    releaseYear: null,
    origin: null,
    language: null,
    genres: [],
    projectType: null,
    proposedBy: entry.proposed_by_name,
    listenedBy: entry.listened_by_name,
    rating: null,
    shortReview: null,
    detailedReview: null,
    bestTrack: { title: null, url: null },
    worstTrack: { title: null, url: null },
    albumUrl: entry.youtube_music_url,
    artistDescription: null,
    albumDescription: null,
    status: "pending",
    drawNumber: entry.draw_number,
    drawStatus: entry.draw_status,
    drawUpdatedAt: entry.updated_at,
    archiveNumber: entry.archive_number,
  };
}
function isArchived(entry: LiveEntry, album: Album) {
  return (
    normalizeMusicText(entry.album_title ?? "") ===
      normalizeMusicText(album.title) &&
    normalizeMusicText(entry.album_artist ?? "") ===
      normalizeMusicText(album.artist)
  );
}
function GridIcon() {
  return (
    <svg className="view-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg className="view-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6h14M5 12h14M5 18h14" />
    </svg>
  );
}

export function AlbumExplorer({ albums }: { albums: Album[] }) {
  const configured = isSupabaseConfigured();
  const [live, setLive] = useState<LiveEntry[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<
    | "latest"
    | "oldest"
    | "pending"
    | "title"
    | "rating"
    | "proposed"
    | "listened"
  >("latest");
  const [member, setMember] = useState("");
  const currentDrawArchiveIds = useMemo(
    () =>
      new Set(
        albums
          .filter((album) => album.drawStatus === "published" && album.status === "pending")
          .map((album) => album.id),
      ),
    [albums],
  );
  useEffect(() => {
    if (!configured) return;
    const timer = setTimeout(() => {
      const supabase = getSupabaseBrowserClient();
      const loadEntries = async () => {
        const withArchiveNumber = await supabase
          .from("club_draw_entries")
          .select(
            "id, draw_number, position, archive_number, updated_at, proposed_by_name, listened_by_name, album_title, album_artist, cover_path, cover_source_url, youtube_music_url",
          )
          .not("album_title", "is", null)
          .not("album_artist", "is", null)
          .order("draw_number", { ascending: false })
          .order("position", { ascending: true });
        if (!withArchiveNumber.error) return withArchiveNumber;

        // A stale PostgREST schema must never hide the club's recent draws.
        return supabase
          .from("club_draw_entries")
          .select(
            "id, draw_number, position, updated_at, proposed_by_name, listened_by_name, album_title, album_artist, cover_path, cover_source_url, youtube_music_url",
          )
          .not("album_title", "is", null)
          .not("album_artist", "is", null)
          .order("draw_number", { ascending: false })
          .order("position", { ascending: true });
      };

      void Promise.all([
        loadEntries(),
        supabase.from("club_draws").select("draw_number, status"),
      ]).then(([entriesResult, drawsResult]) => {
        const statuses = new Map(
          ((drawsResult.data ?? []) as Array<{ draw_number: number; status: DrawStatus }>).map(
            (draw) => [Number(draw.draw_number), draw.status],
          ),
        );
        setLive(
          ((entriesResult.data ?? []) as Array<Omit<LiveEntry, "draw_status">>).map(
            (entry) => ({
              ...entry,
              archive_number: entry.archive_number ?? null,
              draw_status: statuses.get(entry.draw_number) ?? "draft",
            }),
          ),
        );
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [configured]);
  const merged = useMemo(
    () => [
      ...live
        .filter((entry) => !albums.some((album) => isArchived(entry, album)))
        .map(liveAlbum),
      ...albums,
    ],
    [albums, live],
  );
  const results = useMemo(
    () =>
      merged
        .filter((album) =>
          `${album.title} ${album.artist} ${album.genres.join(" ")}`
            .toLocaleLowerCase("fr")
            .includes(query.toLocaleLowerCase("fr")),
        )
        .filter(
          (album) =>
            !member ||
            [album.proposedBy, album.listenedBy].some(
              (name) => memberName(name) === member,
            ),
        )
        .sort((a, b) => {
          // The date an album entered the club is represented by its draw
          // number. Archive positions are only used as a legacy fallback.
          const livePositions = new Map<string, number>(
            live.map((entry): [string, number] => [`live-${entry.id}`, entry.position]),
          );
          const chronology = (album: Album) => {
            const archivePosition = album.id.startsWith("archive-")
              ? Number(album.id.replace("archive-", ""))
              : 0;
            return {
              draw: album.drawNumber ?? Math.ceil(archivePosition / 9),
              position: livePositions.get(album.id) ?? archivePosition,
            };
          };
          const compareByDateGiven = (left: Album, right: Album) => {
            const leftDate = chronology(left);
            const rightDate = chronology(right);
            return (
              rightDate.draw - leftDate.draw ||
              rightDate.position - leftDate.position
            );
          };
          if (sort === "latest") {
            return (
              archiveNumber(b) - archiveNumber(a) ||
              compareByDateGiven(a, b) ||
              a.title.localeCompare(b.title, "fr")
            );
          }
          if (sort === "oldest") return archiveNumber(a) - archiveNumber(b) || compareByDateGiven(b, a) || a.title.localeCompare(b.title, "fr");
          if (sort === "pending")
            return (
              Number(a.status !== "pending") - Number(b.status !== "pending") ||
              compareByDateGiven(a, b)
            );
          if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
          if (sort === "proposed")
            return (
              memberName(a.proposedBy).localeCompare(
                memberName(b.proposedBy),
                "fr",
              ) || a.title.localeCompare(b.title, "fr")
            );
          if (sort === "listened")
            return (
              memberName(a.listenedBy).localeCompare(
                memberName(b.listenedBy),
                "fr",
              ) || a.title.localeCompare(b.title, "fr")
            );
          return a.title.localeCompare(b.title, "fr");
        }),
    [member, merged, query, sort],
  );
  return (
    <>
      <div className="filter-bar">
        <label>
          Rechercher
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Album, artiste, genre…"
          />
        </label>
        <label>
          Tri
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="latest">Plus récent</option>
            <option value="oldest">Plus ancien</option>
            <option value="pending">En attente d’écoute</option>
            <option value="title">Alphabétique</option>
            <option value="rating">Note</option>
            <option value="proposed">Proposé par</option>
            <option value="listened">Écouté par</option>
          </select>
        </label>
        <label>
          Membre
          <select
            value={member}
            onChange={(event) => setMember(event.target.value)}
          >
            <option value="">Tous les membres</option>
            {members.map((clubMember) => (
              <option
                key={clubMember.slug}
                value={clubMember.displayName.toLocaleLowerCase("fr")}
              >
                {clubMember.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="view-toggle">
          <button
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
          >
            <GridIcon />
            <span>Grille</span>
          </button>
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            <ListIcon />
            <span>Liste</span>
          </button>
        </div>
      </div>
      <p className="result-count">
        {results.length} archive{results.length > 1 ? "s" : ""} retrouvée
        {results.length > 1 ? "s" : ""}
      </p>
      {results.length ? (
        <div className={view === "grid" ? "album-grid" : "album-list"}>
          {results.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              list={view === "list"}
              currentDraw={currentDrawArchiveIds.has(album.id)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <b>Aucun disque dans ce bac.</b>
          <p>Essaie un autre titre, un artiste ou un membre.</p>
          <button
            onClick={() => {
              setQuery("");
              setMember("");
            }}
          >
            Réinitialiser
          </button>
        </div>
      )}
    </>
  );
}
