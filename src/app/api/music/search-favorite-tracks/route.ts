import { NextResponse } from "next/server";
import { authenticatedUser, cleanText, consumeSearchQuota, error } from "@/lib/music-server";

export const dynamic = "force-dynamic";

type DeezerTrack = {
  id?: number;
  title?: string;
  artist?: { name?: string };
  album?: { title?: string; cover_xl?: string; cover_big?: string; cover_medium?: string };
};

export async function POST(request: Request) {
  const user = await authenticatedUser(request).catch(() => null);
  if (!user) return error("Connexion requise.", 401);
  const body = await request.json().catch(() => null);
  const title = cleanText(body?.title, 180);
  const artist = cleanText(body?.artist, 160);
  if (!title || !artist) return error("Le morceau et l’artiste sont requis.", 400);
  try {
    if (!await consumeSearchQuota(user.id, "track")) return error("Trop de recherches : réessaie dans quelques minutes.", 429);
    const query = new URL("https://api.deezer.com/search/track");
    query.searchParams.set("q", `track:"${title.replace(/"/g, " ")}" artist:"${artist.replace(/"/g, " ")}"`);
    query.searchParams.set("limit", "8");
    const response = await fetch(query, { cache: "no-store", signal: AbortSignal.timeout(9_000) });
    if (!response.ok) throw new Error("deezer_http_error");
    const body = await response.json() as { data?: DeezerTrack[] };
    const candidates = (body.data ?? []).flatMap((track) => {
      const trackTitle = track.title?.trim();
      const trackArtist = track.artist?.name?.trim();
      if (!track.id || !trackTitle || !trackArtist) return [];
      return [{
        id: String(track.id),
        title: trackTitle,
        artist: trackArtist,
        albumTitle: track.album?.title?.trim() ?? null,
        coverUrl: track.album?.cover_xl ?? track.album?.cover_big ?? track.album?.cover_medium ?? null,
        deezerUrl: `https://www.deezer.com/track/${track.id}`,
      }];
    });
    return NextResponse.json({ candidates });
  } catch {
    return error("La recherche Deezer est momentanément indisponible.", 503);
  }
}