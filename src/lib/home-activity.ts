import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type HomeActivity = {
  id: string;
  kind: "proposal" | "verdict" | "meme" | "draw";
  title: string;
  detail: string;
  occurredAt: string;
  href: string;
};

type DrawEntry = { id: string; draw_number: number; album_title: string | null; album_artist: string | null; proposed_by_name: string | null; listened_by_name: string | null; updated_at: string };
type Review = { album_id: string; rating: number; updated_at: string };
type MemePost = { id: string; caption: string | null; created_at: string };
type Draw = { draw_number: number; status: "draft" | "published" | "locked"; draw_type: "standard" | "global"; created_at: string; published_at: string | null; locked_at: string | null };

function memberName(name: string | null) {
  if (!name) return "Un membre";
  const normalized = name.trim().toLocaleLowerCase();
  return normalized === "thomas" ? "Toma" : `${normalized.slice(0, 1).toLocaleUpperCase()}${normalized.slice(1)}`;
}

export async function getHomeActivity(): Promise<HomeActivity[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const supabase = getSupabaseAdmin();
    const [entriesResult, reviewsResult, memesResult, drawsResult] = await Promise.all([
      supabase.from("club_draw_entries").select("id, draw_number, album_title, album_artist, proposed_by_name, listened_by_name, updated_at").not("album_title", "is", null).not("album_artist", "is", null).order("updated_at", { ascending: false }).limit(40),
      supabase.from("member_album_reviews").select("album_id, rating, updated_at").order("updated_at", { ascending: false }).limit(20),
      supabase.from("meme_posts").select("id, caption, created_at").order("created_at", { ascending: false }).limit(1),
      supabase.from("club_draws").select("draw_number, status, draw_type, created_at, published_at, locked_at").order("draw_number", { ascending: false }).limit(1),
    ]);
    if (entriesResult.error || reviewsResult.error || memesResult.error || drawsResult.error) return [];

    const entries = (entriesResult.data ?? []) as DrawEntry[];
    const latestProposal = entries[0];
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));
    const latestReview = ((reviewsResult.data ?? []) as Review[]).find((review) => entryById.has(review.album_id));
    const latestMeme = (memesResult.data ?? [])[0] as MemePost | undefined;
    const latestDraw = (drawsResult.data ?? [])[0] as Draw | undefined;
    const activity: HomeActivity[] = [];

    if (latestProposal) activity.push({ id: `proposal-${latestProposal.id}`, kind: "proposal", title: "Nouvel album proposé", detail: `${memberName(latestProposal.proposed_by_name)} a proposé ${latestProposal.album_title} — ${latestProposal.album_artist}.`, occurredAt: latestProposal.updated_at, href: `/albums/live-${latestProposal.id}` });
    if (latestReview) {
      const entry = entryById.get(latestReview.album_id)!;
      activity.push({ id: `verdict-${latestReview.album_id}`, kind: "verdict", title: "Verdict rendu", detail: `${memberName(entry.listened_by_name)} a noté ${entry.album_title} : ${Number(latestReview.rating).toFixed(1)}/5.`, occurredAt: latestReview.updated_at, href: `/albums/live-${entry.id}` });
    }
    if (latestMeme) activity.push({ id: `meme-${latestMeme.id}`, kind: "meme", title: "Nouveau mème", detail: latestMeme.caption?.trim() || "Un nouveau dossier a rejoint le musée du club.", occurredAt: latestMeme.created_at, href: "/memes" });
    if (latestDraw) {
      const namedEntries = entries.filter((entry) => entry.draw_number === latestDraw.draw_number).length;
      const namedAlbums = latestDraw.draw_type === "global" ? Number(namedEntries > 0) : namedEntries;
      const status = latestDraw.status === "locked" ? "est verrouillé" : latestDraw.status === "published" ? "est en cours" : "se prépare";
      activity.push({ id: `draw-${latestDraw.draw_number}`, kind: "draw", title: `Tirage ${String(latestDraw.draw_number).padStart(2, "0")}`, detail: `Le tirage ${status} · ${namedAlbums} album${namedAlbums > 1 ? "s" : ""} renseigné${namedAlbums > 1 ? "s" : ""}.`, occurredAt: latestDraw.locked_at ?? latestDraw.published_at ?? latestDraw.created_at, href: "/tableur" });
    }
    return activity.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  } catch {
    return [];
  }
}
