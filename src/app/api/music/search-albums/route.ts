import { NextResponse } from "next/server";
import { authenticatedUser, cleanText, consumeSearchQuota, error, searchItunesAlbums, searchYouTubeMusic } from "@/lib/music-server";

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
    // A dedicated album catalogue has canonical title, artist and artwork
    // metadata. Prefer it over YouTube's video-oriented search results.
    const catalogue = await searchItunesAlbums(title, artist).catch((catalogueError) => {
      console.error("[music-search] album catalogue failed", {
        code: catalogueError instanceof Error ? catalogueError.message : "unknown",
      });
      return null;
    });
    if (catalogue?.candidates.length) return NextResponse.json(catalogue);
    return NextResponse.json(await searchYouTubeMusic("album", title, artist));
  } catch (searchError) {
    const failure = searchError instanceof Error ? searchError.message : "unknown";
    console.error("[music-search] album search failed", {
      code: failure,
      titleLength: title.length,
      artistLength: artist.length,
    });
    if (failure.startsWith("youtube_api_http_429_")) {
      try {
        return NextResponse.json(await searchItunesAlbums(title, artist));
      } catch (fallbackError) {
        console.error("[music-search] iTunes fallback failed", {
          code: fallbackError instanceof Error ? fallbackError.message : "unknown",
        });
      }
    }
    if (failure === "youtube_api_key_missing") return error("La recherche YouTube n’est pas encore configurée sur le serveur. Tu peux continuer manuellement.", 503);
    if (failure.startsWith("youtube_api_http_401_") || failure.startsWith("youtube_api_http_403_")) return error("YouTube refuse la clé du serveur. Vérifie que YouTube Data API v3 est activée et que les restrictions de la clé autorisent ce projet Vercel.", 502);
    if (failure === "youtube_network_unavailable") return error("La connexion au service YouTube a expiré. Réessaie dans un instant.", 503);
    if (searchError instanceof Error && searchError.message === "service_unavailable") return error("La recherche YouTube n’est pas encore configurée sur le serveur. Tu peux continuer manuellement.", 503);
    return error("La recherche musicale est momentanément indisponible. Tu peux continuer manuellement.", 503);
  }
}
