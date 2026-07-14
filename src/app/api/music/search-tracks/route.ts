import { NextResponse } from "next/server";
import { authenticatedUser, cleanText, consumeSearchQuota, error, searchYouTubeMusic } from "@/lib/music-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await authenticatedUser(request).catch(() => null);
  if (!user) return error("Connexion requise.", 401);
  const body = await request.json().catch(() => null);
  const title = cleanText(body?.title, 200);
  const artist = cleanText(body?.artist, 150);
  const albumTitle = cleanText(body?.albumTitle, 200);
  if (!title || !artist) return error("Le morceau et l’artiste sont requis.", 400);
  try {
    if (!await consumeSearchQuota(user.id, "track")) return error("Trop de recherches : réessaie dans quelques minutes.", 429);
    return NextResponse.json(await searchYouTubeMusic("track", title, artist, albumTitle));
  } catch {
    return error("La recherche musicale est momentanément indisponible. Tu peux continuer manuellement.", 503);
  }
}
