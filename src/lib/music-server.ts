import "server-only";
import { NextResponse } from "next/server";
import { cacheKey, classifyConfidence, musicUrls, scoreMusicCandidate, type MusicCandidate, type MusicResourceType } from "@/lib/music-matching";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type AuthenticatedUser = { id: string };

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export { error };

export async function authenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  const value = request.headers.get("authorization");
  const token = value?.startsWith("Bearer ") ? value.slice(7).trim() : "";
  if (!token) return null;
  const { data, error: authError } = await getSupabaseAdmin().auth.getUser(token);
  if (authError || !data.user) return null;
  return { id: data.user.id };
}

export function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export async function consumeSearchQuota(userId: string, type: "album" | "track") {
  // Supabase types are generated separately; this server-only path reaches new tables immediately after migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: quotaError } = await (getSupabaseAdmin() as any).rpc("consume_music_search_quota", { p_user_id: userId, p_search_type: type });
  if (quotaError) throw new Error("quota_unavailable");
  return data === true;
}

type YouTubeSearchItem = {
  id?: { kind?: string; videoId?: string; playlistId?: string };
  snippet?: { title?: string; channelTitle?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } } };
};

async function fromCache(searchType: "album" | "track", query: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (getSupabaseAdmin() as any).from("music_search_cache")
    .select("response")
    .eq("search_type", searchType)
    .eq("normalized_query", query)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Array.isArray(data?.response) ? data.response as MusicCandidate[] : null;
}

async function storeCache(searchType: "album" | "track", query: string, candidates: MusicCandidate[]) {
  const expiresAt = new Date(Date.now() + (searchType === "album" ? 14 : 4) * 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (getSupabaseAdmin() as any).from("music_search_cache").upsert({ search_type: searchType, normalized_query: query, response: candidates, expires_at: expiresAt }, { onConflict: "search_type,normalized_query" });
}

export async function searchYouTubeMusic(searchType: "album" | "track", title: string, artist: string, albumTitle?: string) {
  const query = cacheKey(searchType, title, artist, albumTitle ?? "");
  const cached = await fromCache(searchType, query);
  if (cached) return { candidates: cached, cached: true };

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("service_unavailable");
  const requestQuery = [title, artist, albumTitle, searchType === "album" ? "album" : "audio"].filter(Boolean).join(" ");
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({ part: "snippet", maxResults: "5", q: requestQuery, type: "video,playlist", key: apiKey }).toString();
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("service_unavailable");
  const body = await response.json() as { items?: YouTubeSearchItem[] };
  const candidates = (body.items ?? []).flatMap((item): MusicCandidate[] => {
    const resourceType: MusicResourceType | null = item.id?.playlistId ? "playlist" : item.id?.videoId ? "video" : null;
    const resourceId = item.id?.playlistId ?? item.id?.videoId ?? null;
    const candidateTitle = item.snippet?.title?.trim() ?? "";
    if (!resourceType || !resourceId || !candidateTitle) return [];
    const channelTitle = item.snippet?.channelTitle?.trim() ?? "";
    const thumbnailUrl = item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null;
    const score = scoreMusicCandidate({ title, artist, candidateTitle, candidateArtist: channelTitle, channelTitle, resourceType, thumbnailUrl });
    const urls = musicUrls(resourceType, resourceId, requestQuery);
    return [{ id: `${resourceType}:${resourceId}`, title: candidateTitle, artist, channelTitle, thumbnailUrl, resourceType, resourceId, ...urls, itemCount: null, score, confidence: classifyConfidence(score), source: "youtube_search" }];
  }).sort((left, right) => right.score - left.score);
  await storeCache(searchType, query, candidates);
  return { candidates, cached: false };
}

export async function isEntryEditor(entryId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = getSupabaseAdmin();
  const [{ data: entry }, { data: profile }] = await Promise.all([
    supabase.from("club_draw_entries").select("id, proposed_by, music_metadata_locked").eq("id", entryId).maybeSingle(),
    supabase.from("member_profiles").select("role").eq("id", userId).maybeSingle(),
  ]);
  if (!entry) return { allowed: false, isAdmin: false, locked: false };
  const isAdmin = profile?.role === "admin";
  return { allowed: isAdmin || entry.proposed_by === userId, isAdmin, locked: entry.music_metadata_locked === true };
}
