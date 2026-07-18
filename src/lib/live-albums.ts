import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { albums as archivedAlbums } from "@/data/albums";
import { albumIdentityKey, findArchiveAlbumMatch } from "@/lib/album-live-sync";
import { getOptionalSupabaseServerReader } from "@/lib/supabase/server-reader";
import type { Album } from "@/types/album";

const LIVE_SLUG = /^live-([0-9a-f-]{36})$/i;

type LiveEntry = {
  id: string;
  draw_number: number;
  position: number;
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
};

type PublicLiveReview = LiveReview & { album_id: string };

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

const EDITORIAL_FIELDS =
  "draw_entry_id, release_year, origin, language, genres, project_type, artist_description, album_description";
const LIVE_ENTRY_FIELDS =
  "id, draw_number, position, updated_at, proposed_by_name, listened_by_name, album_title, album_artist, cover_path, cover_source_url, youtube_music_url";

function resolveLiveCover(entry: LiveEntry, supabase: SupabaseClient) {
  if (entry.cover_path) {
    return supabase.storage.from("album-covers").getPublicUrl(entry.cover_path).data.publicUrl;
  }
  return entry.cover_source_url ?? "/album-a-venir.png";
}

function materializeLiveAlbum(
  entry: LiveEntry,
  review: LiveReview | undefined,
  editorial: EditorialMetadata | undefined,
  supabase: SupabaseClient,
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
        url: archived.bestTrack.url,
      },
      worstTrack: {
        title: review?.worst_track ?? null,
        url: archived.worstTrack.url,
      },
      albumUrl: entry.youtube_music_url ?? archived.albumUrl,
      cover: archived.cover ?? liveCover,
      artistDescription: editorial?.artist_description ?? archived.artistDescription,
      albumDescription: editorial?.album_description ?? archived.albumDescription,
      status: rating === null ? "pending" : "rated",
      drawNumber: entry.draw_number,
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
    bestTrack: { title: review?.best_track ?? null, url: null },
    worstTrack: { title: review?.worst_track ?? null, url: null },
    albumUrl: entry.youtube_music_url ?? null,
    artistDescription: editorial?.artist_description ?? null,
    albumDescription: editorial?.album_description ?? null,
    status: rating === null ? "pending" : "rated",
    drawNumber: entry.draw_number,
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
    materializeLiveAlbum(entry, reviewMap.get(entry.id), editorialMap.get(entry.id), supabase),
  );
  return collapseGlobalDrawAlbums(albums, globalDrawNumbers);
}
export async function getLiveAlbum(slug: string): Promise<Album | null> {
  const match = LIVE_SLUG.exec(slug);
  if (!match) return null;

  const supabase = getOptionalSupabaseServerReader();
  if (!supabase) return null;
  const [{ data: entryData }, { data: reviewData }, { data: editorialData }] = await Promise.all([
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
  ]);
  const entry = entryData as unknown as LiveEntry | null;
  const review = reviewData as unknown as LiveReview | null;
  const editorial = editorialData as unknown as EditorialMetadata | null;

  if (!entry?.album_title?.trim() || !entry.album_artist?.trim()) return null;
  return materializeLiveAlbum(entry, review ?? undefined, editorial ?? undefined, supabase);
}

export async function getLatestLiveAlbums(limit = 6): Promise<Album[]> {
  const supabase = getOptionalSupabaseServerReader();
  if (!supabase) return [];
  const safeLimit = Math.max(1, Math.min(limit, 24));
  const { data: drawData, error: drawError } = await supabase
    .from("club_draws")
    .select("draw_number, draw_type")
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
  );
}

export async function getPublishedLiveAlbums(): Promise<Album[]> {
  const supabase = getOptionalSupabaseServerReader();
  if (!supabase) return [];
  const { data: drawData, error: drawError } = await supabase
    .from("club_draws")
    .select("draw_number, draw_type")
    .in("status", ["published", "locked"])
    .order("draw_number", { ascending: true });
  if (drawError || !drawData?.length) return [];

  const drawNumbers = drawData.map((draw) => Number(draw.draw_number));
  const [{ data: entryData, error: entryError }, { data: reviewData, error: reviewError }] = await Promise.all([
    supabase
      .from("club_draw_entries")
      .select(LIVE_ENTRY_FIELDS)
      .in("draw_number", drawNumbers)
      .not("album_title", "is", null)
      .not("album_artist", "is", null)
      .order("draw_number", { ascending: true })
      .order("position", { ascending: true })
      .limit(1000),
    supabase.rpc("get_public_draw_reviews"),
  ]);
  if (entryError || reviewError) return [];

  return materializeEntries(
    (entryData ?? []) as unknown as LiveEntry[],
    (reviewData ?? []) as PublicLiveReview[],
    supabase,
    new Set((drawData as Array<{ draw_number: number; draw_type?: string }>).filter((draw) => draw.draw_type === "global").map((draw) => Number(draw.draw_number))),
  );
}

export async function getSynchronizedAlbums(): Promise<Album[]> {
  const liveAlbums = await getPublishedLiveAlbums();
  const synchronizedByArchiveId = new Map(
    liveAlbums
      .filter((album) => album.id.startsWith("archive-"))
      .map((album) => [album.id, album]),
  );
  const liveOnlyAlbums = new Map<string, Album>();
  for (const album of liveAlbums.filter((item) => item.id.startsWith("live-"))) {
    liveOnlyAlbums.set(albumIdentityKey(album.title, album.artist), album);
  }

  return [
    ...archivedAlbums.map((album) => synchronizedByArchiveId.get(album.id) ?? album),
    ...liveOnlyAlbums.values(),
  ];
}