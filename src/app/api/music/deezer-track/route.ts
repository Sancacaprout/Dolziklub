import { NextResponse } from "next/server";

const clean = (value: string | null, length: number) => value?.trim().slice(0, length) ?? "";
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
type DeezerItem = { id?: number; title?: string; artist?: { name?: string }; album?: { title?: string } };

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const title = clean(requestUrl.searchParams.get("title"), 160);
  const artist = clean(requestUrl.searchParams.get("artist"), 140);
  const album = clean(requestUrl.searchParams.get("album"), 160);
  if (!title || !artist) return NextResponse.json({ error: "Le morceau et l’artiste sont requis." }, { status: 400 });
  const search = new URL("https://api.deezer.com/search/track");
  search.searchParams.set("q", `track:\"${title.replace(/\"/g, " ")}\" artist:\"${artist.replace(/\"/g, " ")}\"`);
  search.searchParams.set("limit", "8");
  try {
    const response = await fetch(search, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error("deezer_http_error");
    const body = await response.json() as { data?: DeezerItem[] };
    const expectedTitle = normalized(title); const expectedArtist = normalized(artist); const expectedAlbum = normalized(album);
    const candidates = (body.data ?? []).filter((item) => item.id && item.title && item.artist?.name);
    const score = (item: DeezerItem) => Number(normalized(item.title ?? "") === expectedTitle) * 4 + Number(normalized(item.artist?.name ?? "") === expectedArtist) * 3 + Number(Boolean(expectedAlbum) && normalized(item.album?.title ?? "") === expectedAlbum);
    const match = candidates.sort((left, right) => score(right) - score(left))[0];
    if (!match?.id || !match.title || !match.artist?.name) return NextResponse.json({ error: "Aucun morceau Deezer correspondant n’a été trouvé." }, { status: 404 });
    return NextResponse.json({ track: { id: match.id, title: match.title, artist: match.artist.name, album: match.album?.title ?? null, url: `https://www.deezer.com/track/${match.id}` } });
  } catch {
    return NextResponse.json({ error: "La recherche Deezer est momentanément indisponible." }, { status: 503 });
  }
}