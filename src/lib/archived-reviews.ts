import "server-only";

import { createClient } from "@supabase/supabase-js";
import { sourceArchiveReviewId as getAlignedSourceArchiveReviewId } from "@/lib/archive-review-alignment";

export type ArchivedReviewOverride = {
  review: string | null;
  rating: number | null;
  best_track: string | null;
  worst_track: string | null;
  is_modified: boolean;
  review_title?: string | null;
};

// Une ancienne importation a d?cal? les lignes apr?s le double album de South Arcade.
// Les fiches statiques gardent les bons albums : on lit donc la ligne Supabase correspondante.
export function sourceArchiveReviewId(albumId: string) {
  return getAlignedSourceArchiveReviewId(albumId);
}

function getArchiveReviewReader() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) throw new Error("supabase_read_unavailable");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getArchivedReviewOverride(albumId: string) {
  const sourceAlbumId = sourceArchiveReviewId(albumId);
  if (!sourceAlbumId) return null;

  const supabase = getArchiveReviewReader();
  const { data } = await supabase
    .from("archived_album_reviews")
    .select("review, rating, best_track, worst_track, is_modified, review_title")
    .eq("album_id", sourceAlbumId)
    .maybeSingle();

  return (data as ArchivedReviewOverride | null) ?? null;
}
