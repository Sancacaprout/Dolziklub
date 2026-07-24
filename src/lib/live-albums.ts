import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { albums as archivedAlbums } from "@/data/albums";
import { albumIdentityKey, findArchiveAlbumMatch } from "@/lib/album-live-sync";
import { getOptionalSupabaseServerReader } from "@/lib/supabase/server-reader";
import type { Album } from "@/types/album";

const LIVE_SLUG = /^live-([0-9a-f-]{36})$/i;
type DrawStatus = "draft" | "published" | "locked";

type LiveEntry = {
  id: string;
  draw_number: number;
  position: number;
  archive_number: number | null;
  updated_at: string;
  proposed_by_name: string | null;
  listened_by_name: string | null;
  album_title: string | null;
  album_artist: string | null;
  cover_path: string | null;
  cover_source_url: string | null;
  youtube_music_url: string | null;
};

type LiveReview = {
  review_title: string | null;
  review: string;
  rating: number;
  best_track: string | null;
  worst_track: string | null;
  best_track_youtube_music_url?: string | null;
  worst_track_youtube_music_url?: string | null;
};

type PublicLiveReview = LiveReview & { album_id: string };

type ArchivedReviewOverride = {
  album_id: string;
  review_title: string | null;
  review: string | null;
  rating: number | null;
  best_track: string | null;
  worst_track: string | null;
  is_modified: boolean;
};

type EditorialMetadata = {
  draw_entry_id: string;
  release_year: number | null;
  origin: string | null;
  language: string | null;
  genres: string[];
  project_type: string | null;
  artist_description: string | null;
  album_description: string | null;
};

type AlbumCoverOverride = { album_id: string; cover_path: string };

async function getArchiveCoverOverrides(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("album_cover_overrides")
    .select("album_id, cover_path");
  if (error) return new Map<string, string>();
  return new Map(
    ((data ?? []) as unknown as AlbumCoverOverride[]).map((override) => [override.album_id, override.cover_path]),
  );
}

function applyArchiveCoverOverrides(albums: Album[], overrides: Map<string, string>, supabase: SupabaseClient) {
  return albums.map((album) => {
    const path = overrides.get(album.id);
    return path
      ? { ...album, cover: supabase.storage.from("album-covers").getPublicUrl(path).data.publicUrl }
      : album;
  });
}


async function getArchivedReviewOverrides(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("archived_album_reviews")
    .select("album_id, review_title, review, rating, best_track, worst_track, is_modified");
  if (error) return new Map<string, ArchivedReviewOverride>();
  return new Map(
    ((data ?? []) as unknown as ArchivedReviewOverride[]).map((review) => [review.album_id, review]),
  );
}

function applyArchivedReviewOverrides(
  albums: Album[],
  overrides: Map<string, ArchivedReviewOverride>,
): Album[] {
  return albums.map((album) => {
    const review = overrides.get(album.id);
    if (!review?.is_modified) return album;
    const rating = review.rating === null ? null : Number(review.rating);
    const status: Album["status"] = rating === null ? "pending" : "rated";
    return {
      ...album,
      rating,
      shortReview: review.review_title ?? review.review,
      detailedReview: review.review_title ? review.review : null,
      bestTrack: { ...album.bestTrack, title: review.best_track },
      worstTrack: { ...album.worstTrack, title: review.worst_track },
      status,
    };
  });
}

function resolveEntryCover(entry: LiveEntry, supabase: SupabaseClient) {
  if (entry.cover_path) {
    return supabase.storage.from("album-covers").getPublicUrl(entry.cover_path).data.publicUrl;
  }
  return entry.cover_source_url;
}

const EDITORIAL_FIELDS =
  "draw_entry_id, release_year, origin, language, genres, project_type, artist_description, album_description";
const LIVE_ENTRY_FIELDS =
  "id, draw_number, position, archive_number, updated_at, proposed_by_name, listened_by_name, album_title, album_artist, cover_path, cover_source_url, youtube_music_url";

function resolveLiveCover(entry: LiveEntry, supabase: SupabaseClient) {
  return resolveEntryCover(entry, supabase) ?? "/album-a-venir.png";
}

function materializeLiveAlbum(
  entry: LiveEntry,
  review: LiveReview | undefined,
  editorial: EditorialMetadata | undefined,
  supabase: SupabaseClient,
  drawStatus: DrawStatus | null = null,
): Album {
  const title = entry.album_title!.trim();
  const artist = entry.album_artist!.trim();
  const archived = findArchiveAlbumMatch(archivedAlbums, title, artist);
  const rating = review?.rating == null ? null : Number(review.rating);
  const liveCover = resolveLiveCover(entry, supabase);
  const shortReview = review?.review_title ?? review?.review ?? null;
  const detailedReview = review?.review_title ? review.review : null;

  if (archived) {
    return {
      ...archived,
      releaseYear: editorial?.release_year ?? archived.releaseYear,
      origin: editorial?.origin ?? archived.origin,
      language: editorial?.language ?? archived.language,
      genres: editorial ? editorial.genres : archived.genres,
      projectType: editorial?.project_type ?? archived.projectType,
      proposedBy: entry.proposed_by_name ?? archived.proposedBy,
      listenedBy: entry.listened_by_name ?? archived.listenedBy,
      rating,
      shortReview,
      detailedReview,
      bestTrack: {
        title: review?.best_track ?? null,
        url: review?.best_track_youtube_music_url ?? archived.bestTrack.url,
      },
      worstTrack: {
        title: review?.worst_track ?? null,
        url: review?.worst_track_youtube_music_url ?? archived.worstTrack.url,
      },
      albumUrl: entry.youtube_music_url ?? archived.albumUrl,
      cover: resolveEntryCover(entry, supabase) ?? archived.cover ?? liveCover,
      artistDescription: editorial?.artist_description ?? archived.artistDescription,
      albumDescription: editorial?.album_description ?? archived.albumDescription,
      status: rating === null ? "pending" : "rated",
      drawNumber: entry.draw_number,
      drawStatus,
      drawUpdatedAt: entry.updated_at,
      archiveNumber: entry.archive_number,
      liveEntryId: entry.id,
    };
  }

  return {
    id: `live-${entry.id}`,
    slug: `live-${entry.id}`,
    title,
    artist,
    cover: liveCover,
    releaseYear: editorial?.release_year ?? null,
    origin: editorial?.origin ?? null,
    language: editorial?.language ?? null,
    genres: editorial?.genres ?? [],
    projectType: editorial?.project_type ?? null,
    proposedBy: entry.proposed_by_name,
    listenedBy: entry.listened_by_name,
    rating,
    shortReview,
    detailedReview,
    bestTrack: { title: review?.best_track ?? null, url: review?.best_track_youtube_music_url ?? null },
    worstTrack: { title: review?.worst_track ?? null, url: review?.worst_track_youtube_music_url ?? null },
    albumUrl: entry.youtube_music_url ?? null,
    artistDescription: editorial?.artist_description ?? null,
    albumDescription: editorial?.album_description ?? null,
    status: rating === null ? "pending" : "rated",
    drawNumber: entry.draw_number,
    drawStatus,
    drawUpdatedAt: entry.updated_at,
    archiveNumber: entry.archive_number,
    liveEntryId: entry.id,
  };
}

function collapseGlobalDrawAlbums(albums: Album[], globalDrawNumbers: Set<number>) {
  const result: Album[] = [];
  const consumed = new Set<number>();
  for (const album of albums) {
    const drawNumber = album.drawNumber ?? -1;
    if (!globalDrawNumbers.has(drawNumber)) {
      result.push(album);
      continue;
    }
    if (consumed.has(drawNumber)) continue;
    consumed.add(drawNumber);
    const group = albums.filter((candidate) => candidate.drawNumber === drawNumber);
    const ratings = group.flatMap((candidate) => candidate.rating === null ? [] : [candidate.rating]);
    const completed = ratings.length === group.length;
    result.push({
      ...group[0],
      listenedBy: null,
      rating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
      shortReview: ratings.length ? ratings.length + " verdict" + (ratings.length > 1 ? "s" : "") + " rendu" + (ratings.length > 1 ? "s" : "") + " sur " + group.length + "." : null,
      detailedReview: null,
      bestTrack: { title: null, url: null },
      worstTrack: { title: null, url: null },
      status: completed ? "rated" : "pending",
      globalReviews: group.map((candidate) => ({
        entryId: candidate.liveEntryId!,
        listenedBy: candidate.listenedBy,
        rating: candidate.rating,
        shortReview: candidate.shortReview,
        detailedReview: candidate.detailedReview,
        bestTrack: candidate.bestTrack,
        worstTrack: candidate.worstTrack,
      })),
    });
  }
  return result;
}

async function materializeEntries(
  entries: LiveEntry[],
  reviews: PublicLiveReview[],
  supabase: SupabaseClient,
  globalDrawNumbers: Set<number> = new Set(),
  drawStatusByNumber: Map<number, DrawStatus> = new Map(),
) {
  const entryIds = entries.map((entry) => entry.id);
  const { data: editorialData } = entryIds.length
    ? await supabase
        .from("album_editorial_metadata")
        .select(EDITORIAL_FIELDS)
        .in("draw_entry_id", entryIds)
    : { data: [] };
  const reviewMap = new Map(reviews.map((review) => [review.album_id, review]));
  const editorialMap = new Map(
    ((editorialData ?? []) as unknown as EditorialMetadata[]).map((item) => [item.draw_entry_id, item]),
  );
  const albums = entries.map((entry) =>
    materializeLiveAlbum(
      entry,
      reviewMap.get(entry.id),
      editorialMap.get(entry.id),
      supabase,
      drawStatusByNumber.get(entry.draw_number) ?? null,
    ),
  );
  return applyArchiveCoverOverrides(
    collapseGlobalDrawAlbums(albums, globalDrawNumbers), await getArchiveCoverOverrides(supabase), supabase,
  );
}
export async function getLiveAlbum(slug: string): Promise<Album | null> {
  const match = LIVE_SLUG.exec(slug);
  if (!match) return null;

  const supabase = getOptionalSupabaseServerReader();
  if (!supabase) return null;
  const [{ data: entryData }, { data: reviewData }, { data: editorialData }, { data: trackData }] = await Promise.all([
    supabase
      .from("club_draw_entries")
      .select(LIVE_ENTRY_FIELDS)
      .eq("id", match[1])
      .maybeSingle(),
    supabase
      .from("member_album_reviews")
      .select("review_title, review, rating, best_track, worst_track")
      .eq("album_id", match[1])
      .maybeSingle(),
    supabase
      .from("album_editorial_metadata")
      .select(EDITORIAL_FIELDS)
      .eq("draw_entry_id", match[1])
      .maybeSingle(),
    supabase.rpc("get_public_draw_reviews"),
  ]);
  const entry = entryData as unknown as LiveEntry | null;
  const review = reviewData as unknown as LiveReview | null;
  const trackReview = ((trackData ?? []) as unknown as PublicLiveReview[])
    .find((candidate) => candidate.album_id === match[1]);
  const linkedReview = review ? { ...review,
    best_track_youtube_music_url: trackReview?.best_track_youtube_music_url ?? null,
    worst_track_youtube_music_url: trackReview?.worst_track_youtube_music_url ?? null,
  } : undefined;
  const editorial = editorialData as unknown as EditorialMetadata | null;

  if (!entry?.album_title?.trim() || !entry.album_artist?.trim()) return null;
  const { data: drawData } = await supabase
    .from("club_draws")
    .select("status")
    .eq("draw_number", entry.draw_number)
    .maybeSingle();
  return applyArchiveCoverOverrides(
    [materializeLiveAlbum(
      entry,
      linkedReview,
      editorial ?? undefined,
      supabase,
      (drawData?.status as DrawStatus | undefined) ?? null,
    )],
    await getArchiveCoverOverrides(supabase),
    supabase,
  )[0] ?? null;
}

export async function getLatestLiveAlbums(limit = 6): Promise<Album[]> {
  const supabase = getOptionalSupabaseServerReader();
  if (!supabase) return [];
  const safeLimit = Math.max(1, Math.min(limit, 24));
  const { data: drawData, error: drawError } = await supabase
    .from("club_draws")
    .select("draw_number, draw_type, status")
    .in("status", ["published", "locked"])
    .order("draw_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (drawError || !drawData) return [];

  const [{ data: entryData, error: entryError }, { data: reviewData, error: reviewError }] = await Promise.all([
    supabase
      .from("club_draw_entries")
      .select(LIVE_ENTRY_FIELDS)
      .eq("draw_number", Number(drawData.draw_number))
      .not("album_title", "is", null)
      .not("album_artist", "is", null)
      .order("updated_at", { ascending: false })
      .limit(safeLimit),
    supabase.rpc("get_public_draw_reviews"),
  ]);
  if (entryError || reviewError) return [];

  return materializeEntries(
    (entryData ?? []) as unknown as LiveEntry[],
    (reviewData ?? []) as PublicLiveReview[],
    supabase,
    new Set(drawData.draw_type === "global" ? [Number(drawData.draw_number)] : []),
    new Map([[Number(drawData.draw_number), drawData.status as DrawStatus]]),
  );
}

export async function getPublishedLiveAlbums(): Promise<Album[]> {
  const supabase = getOptionalSupabaseServerReader();
  if (!supabase) return [];
  const { data: drawData, error: drawError } = await supabase
    .from("club_draws")
    .select("draw_number, draw_type, status")
    .in("status", ["published", "locked"])
    .order("draw_number", { ascending: true });
  if (drawError || !drawData?.length) return [];

  const drawNumbers = drawData.map((draw) => Number(draw.draw_number));
  const loadEntries = async () => {
    const withArchiveNumber = await supabase
      .from("club_draw_entries")
      .select(LIVE_ENTRY_FIELDS)
      .in("draw_number", drawNumbers)
      .not("album_title", "is", null)
      .not("album_artist", "is", null)
      .order("draw_number", { ascending: true })
      .order("position", { ascending: true })
      .limit(1000);
    if (!withArchiveNumber.error) return withArchiveNumber;

    // Keep every published archive visible while the PostgREST schema refreshes.
    return supabase
      .from("club_draw_entries")
      .select("id, draw_number, position, updated_at, proposed_by_name, listened_by_name, album_title, album_artist, cover_path, cover_source_url, youtube_music_url")
      .in("draw_number", drawNumbers)
      .not("album_title", "is", null)
      .not("album_artist", "is", null)
      .order("draw_number", { ascending: true })
      .order("position", { ascending: true })
      .limit(1000);
  };

  const [{ data: entryData, error: entryError }, { data: reviewData, error: reviewError }] = await Promise.all([
    loadEntries(),
    supabase.rpc("get_public_draw_reviews"),
  ]);
  if (entryError || reviewError) return [];

  return materializeEntries(
    (entryData ?? []) as unknown as LiveEntry[],
    (reviewData ?? []) as PublicLiveReview[],
    supabase,
    new Set((drawData as Array<{ draw_number: number; draw_type?: string }>).filter((draw) => draw.draw_type === "global").map((draw) => Number(draw.draw_number))),
    new Map((drawData as Array<{ draw_number: number; status: DrawStatus }>).map((draw) => [Number(draw.draw_number), draw.status])),
  );
}

async function loadSynchronizedAlbums(): Promise<Album[]> {
  const liveAlbums = await getPublishedLiveAlbums();
  const supabase = getOptionalSupabaseServerReader();
  const overrides = supabase ? await getArchiveCoverOverrides(supabase) : new Map<string, string>();
  const archivedReviewOverrides = supabase ? await getArchivedReviewOverrides(supabase) : new Map<string, ArchivedReviewOverride>();
  const synchronizedByArchiveId = new Map(
    liveAlbums
      .filter((album) => album.id.startsWith("archive-"))
      .map((album) => [album.id, album]),
  );
  const liveOnlyAlbums = new Map<string, Album>();
  for (const album of liveAlbums.filter((item) => item.id.startsWith("live-"))) {
    liveOnlyAlbums.set(albumIdentityKey(album.title, album.artist), album);
  }

  const synchronized = [
    ...archivedAlbums.map((album) => synchronizedByArchiveId.get(album.id) ?? album),
    ...liveOnlyAlbums.values(),
  ];
  const reviewed = applyArchivedReviewOverrides(synchronized, archivedReviewOverrides);
  return supabase ? applyArchiveCoverOverrides(reviewed, overrides, supabase) : reviewed;
}
export const getSynchronizedAlbums = unstable_cache(
  loadSynchronizedAlbums,
  ["club-synchronized-albums-v1"],
  { revalidate: 20, tags: ["club-data"] },
);
