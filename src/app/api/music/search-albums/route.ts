import { NextResponse } from "next/server";
import { authenticatedUser, cleanText, consumeSearchQuota, error, searchDeezerAlbums } from "@/lib/music-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await authenticatedUser(request).catch(() => null);
  if (!user) return error("Connexion requise.", 401);
  const body = await request.json().catch(() => null);
  const title = cleanText(body?.title, 200);
  const artist = cleanText(body?.artist, 150);
  if (!title) return error("Écris au moins le titre de l’album.", 400);
  try {
    if (!await consumeSearchQuota(user.id, "album")) return error("Trop de recherches : réessaie dans quelques minutes.", 429);
    return NextResponse.json(await searchDeezerAlbums(title, artist));
  } catch (searchError) {
    const failure = searchError instanceof Error ? searchError.message : "unknown";
    console.error("[music-search] album search failed", {
      code: failure,
      titleLength: title.length,
      artistLength: artist.length,
    });
    if (failure === "deezer_network_unavailable") return error("La connexion à Deezer a expiré. Réessaie dans un instant.", 503);
    return error("Le catalogue Deezer est momentanément indisponible. Tu peux continuer manuellement.", 503);
  }
}
