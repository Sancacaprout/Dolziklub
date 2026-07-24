import { NextResponse } from "next/server";
import {
  authenticatedUser,
  cleanText,
  consumeSearchQuota,
  error,
} from "@/lib/music-server";

export const dynamic = "force-dynamic";

type DeezerArtist = {
  id?: number;
  name?: string;
  picture_xl?: string;
  picture_big?: string;
  picture_medium?: string;
};

export async function POST(request: Request) {
  const user = await authenticatedUser(request).catch(() => null);
  if (!user) return error("Connexion requise.", 401);

  const body = await request.json().catch(() => null);
  const artist = cleanText(body?.artist, 180);
  if (!artist) return error("Écris le nom de l’artiste.", 400);

  try {
    if (!(await consumeSearchQuota(user.id, "artist"))) {
      return error("Trop de recherches : réessaie dans quelques minutes.", 429);
    }
    const url = new URL("https://api.deezer.com/search/artist");
    url.searchParams.set("q", artist);
    url.searchParams.set("limit", "8");
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) throw new Error("deezer_http_error");

    const payload = (await response.json()) as { data?: DeezerArtist[] };
    const candidates = (payload.data ?? []).flatMap((item) => {
      const name = item.name?.trim();
      if (!item.id || !name) return [];
      return [{
        id: String(item.id),
        name,
        imageUrl:
          item.picture_xl ??
          item.picture_big ??
          item.picture_medium ??
          null,
        deezerUrl: `https://www.deezer.com/artist/${item.id}`,
        type: "artist" as const,
      }];
    });

    return NextResponse.json({ candidates });
  } catch {
    return error("La recherche Deezer est momentanément indisponible.", 503);
  }
}
