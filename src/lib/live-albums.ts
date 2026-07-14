import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Album } from "@/types/album";

const LIVE_SLUG = /^live-([0-9a-f-]{36})$/i;
type LiveEntry = {
  id: string;
  proposed_by_name: string | null;
  listened_by_name: string | null;
  album_title: string | null;
  album_artist: string | null;
  cover_path: string | null;
  cover_source_url: string | null;
  youtube_music_url: string | null;
};
type LiveReview = {
  review: string;
  rating: number;
  best_track: string | null;
  worst_track: string | null;
};

function getLiveAlbumReader() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase_read_unavailable");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getLiveAlbum(slug: string): Promise<Album | null> {
  const match = LIVE_SLUG.exec(slug);
  if (!match) return null;

  const supabase = getLiveAlbumReader();
  const [{ data: entryData }, { data: reviewData }] = await Promise.all([
    supabase
      .from("club_draw_entries")
      .select("id, proposed_by_name, listened_by_name, album_title, album_artist, cover_path, cover_source_url, youtube_music_url")
      .eq("id", match[1])
      .maybeSingle(),
    supabase
      .from("member_album_reviews")
      .select("review, rating, best_track, worst_track")
      .eq("album_id", match[1])
      .maybeSingle(),
  ]);
  const entry = entryData as unknown as LiveEntry | null;
  const review = reviewData as unknown as LiveReview | null;

  if (!entry?.album_title?.trim() || !entry.album_artist?.trim()) return null;

  const cover = entry.cover_path
    ? supabase.storage.from("album-covers").getPublicUrl(entry.cover_path).data.publicUrl
    : entry.cover_source_url ?? "/album-a-venir.png";
  const rating = review?.rating == null ? null : Number(review.rating);

  return {
    id: `live-${entry.id}`,
    slug,
    title: entry.album_title,
    artist: entry.album_artist,
    cover,
    releaseYear: null,
    origin: null,
    language: null,
    genres: [],
    projectType: null,
    proposedBy: entry.proposed_by_name,
    listenedBy: entry.listened_by_name,
    rating,
    shortReview: review?.review ?? null,
    detailedReview: null,
    bestTrack: { title: review?.best_track ?? null, url: null },
    worstTrack: { title: review?.worst_track ?? null, url: null },
    albumUrl: entry.youtube_music_url ?? null,
    artistDescription: null,
    albumDescription: null,
    status: rating === null ? "pending" : "rated",
  };
}
