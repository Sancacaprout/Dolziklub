import "server-only";

import { createClient } from "@supabase/supabase-js";

export type ArchivedReviewOverride = {
  review: string | null;
  rating: number | null;
  best_track: string | null;
  worst_track: string | null;
  is_modified: boolean;
};

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
  const supabase = getArchiveReviewReader();
  const { data } = await supabase
    .from("archived_album_reviews")
    .select("review, rating, best_track, worst_track, is_modified")
    .eq("album_id", albumId)
    .maybeSingle();

  return (data as ArchivedReviewOverride | null) ?? null;
}
