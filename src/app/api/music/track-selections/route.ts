import { NextResponse } from "next/server";
import { authenticatedUser, cleanText, error } from "@/lib/music-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type IncomingSelection = { selectionType?: unknown; title?: unknown; artists?: unknown; youtubeVideoId?: unknown; youtubeMusicUrl?: unknown; youtubeUrl?: unknown; thumbnailUrl?: unknown; source?: unknown; verified?: unknown };

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return error("Connexion requise.", 401);
  const body = await request.json().catch(() => null);
  const entryId = cleanText(body?.entryId, 80);
  const reviewId = cleanText(body?.reviewId, 80);
  const selections = Array.isArray(body?.selections) ? body.selections as IncomingSelection[] : [];
  if (!entryId || !reviewId || selections.length > 2) return error("Sélection de morceaux invalide.", 400);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = getSupabaseAdmin();
  const [{ data: review }, { data: entry }, { data: profile }] = await Promise.all([
    supabase.from("member_album_reviews").select("id, album_id, member_id").eq("id", reviewId).maybeSingle(),
    supabase.from("club_draw_entries").select("id, listened_by").eq("id", entryId).maybeSingle(),
    supabase.from("member_profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  const isAdmin = profile?.role === "admin";
  if (!review || !entry || review.album_id !== entryId || (review.member_id !== user.id && !isAdmin) || (entry.listened_by !== review.member_id && !isAdmin)) return error("Tu ne peux pas modifier ces morceaux.", 403);
  try {
    for (const raw of selections) {
      const selectionType = raw.selectionType === "best" || raw.selectionType === "worst" ? raw.selectionType : null;
      if (!selectionType) return error("Type de morceau invalide.", 400);
      const title = cleanText(raw.title, 200);
      if (!title) { await supabase.from("album_track_selections").delete().eq("review_id", reviewId).eq("selection_type", selectionType); continue; }
      const artists = Array.isArray(raw.artists) ? raw.artists.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 8) : [];
      const source = ["album_tracklist", "youtube_search", "manual", "admin"].includes(String(raw.source)) ? String(raw.source) : "manual";
      const payload = { entry_id: entryId, review_id: reviewId, selection_type: selectionType, title, artist_names: artists, youtube_video_id: cleanText(raw.youtubeVideoId, 120) || null, youtube_music_url: cleanText(raw.youtubeMusicUrl, 1000) || null, youtube_url: cleanText(raw.youtubeUrl, 1000) || null, thumbnail_url: cleanText(raw.thumbnailUrl, 1000) || null, source, verified: raw.verified === true };
      const { error: saveError } = await supabase.from("album_track_selections").upsert(payload, { onConflict: "review_id,selection_type" });
      if (saveError) throw saveError;
      if (isAdmin) await supabase.from("music_metadata_audit_log").insert({ entry_id: entryId, actor_id: user.id, event_type: selectionType === "best" ? "best_track_corrected" : "worst_track_corrected", detail: { title } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return error("Les liens des morceaux n’ont pas pu être enregistrés.", 503);
  }
}
