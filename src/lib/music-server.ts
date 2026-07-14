import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  cacheKey,
  classifyConfidence,
  isLikelyAlbumResult,
  musicUrls,
  scoreMusicCandidate,
  type MusicCandidate,
  type MusicResourceType,
} from "@/lib/music-matching";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type AuthenticatedUser = { id: string };

function hasSupabaseAdminConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function getSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase_auth_unavailable");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export { error };

export async function authenticatedUser(
  request: Request,
): Promise<AuthenticatedUser | null> {
  const value = request.headers.get("authorization");
  const token = value?.startsWith("Bearer ") ? value.slice(7).trim() : "";
  if (!token) return null;
  // Verifying a user token only needs the publishable key. This keeps music
  // search available even when the optional server-only cache key is absent.
  const auth = hasSupabaseAdminConfig()
    ? getSupabaseAdmin()
    : getSupabaseAuthClient();
  const { data, error: authError } = await auth.auth.getUser(token);
  if (authError || !data.user) return null;
  return { id: data.user.id };
}

export function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export async function consumeSearchQuota(
  userId: string,
  type: "album" | "track",
) {
  if (!hasSupabaseAdminConfig()) return true;
  // Supabase types are generated separately; this server-only path reaches new tables immediately after migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: quotaError } = await (getSupabaseAdmin() as any).rpc(
    "consume_music_search_quota",
    { p_user_id: userId, p_search_type: type },
  );
  if (quotaError) throw new Error("quota_unavailable");
  return data === true;
}

type YouTubeSearchItem = {
  id?: { kind?: string; videoId?: string; playlistId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
};

type AlbumSearchIntent = { title: string; artist: string };

function cleanAlbumTitle(value: string) {
  return value
    .replace(/\s*[|·]\s*(?:full\s+)?album\b.*$/i, "")
    .replace(/\s*\[(?:official\s+)?(?:audio|video|visualizer|full\s+album).*?\]\s*/gi, "")
    .replace(/\s*\((?:official\s+)?(?:audio|video|visualizer|full\s+album).*?\)\s*/gi, "")
    .replace(/\s*\(\d{4}\)\s*$/i, "")
    .replace(/\s+full\s+album\b.*$/i, "")
    .trim();
}

function albumIntent(title: string, artist: string): AlbumSearchIntent {
  const parts = title
    .split(/\s*[-–—]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 2 && parts.every((part) => part.length > 1)) {
    return { artist: parts[0], title: cleanAlbumTitle(parts[1]) };
  }
  return { artist: artist.trim(), title: cleanAlbumTitle(title) };
}

function artistInCandidate(rawTitle: string) {
  const [first, second] = rawTitle
    .split(/\s+[-–—]\s+/, 2)
    .map((part) => part.trim());
  if (!first || !second || /\b(?:full\s+album|album|audio|official)\b/i.test(first)) return "";
  return first;
}

async function fromCache(searchType: "album" | "track", query: string) {
  if (!hasSupabaseAdminConfig()) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (getSupabaseAdmin() as any)
    .from("music_search_cache")
    .select("response")
    .eq("search_type", searchType)
    .eq("normalized_query", query)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Array.isArray(data?.response)
    ? (data.response as MusicCandidate[])
    : null;
}

async function storeCache(
  searchType: "album" | "track",
  query: string,
  candidates: MusicCandidate[],
) {
  if (!hasSupabaseAdminConfig()) return;
  const expiresAt = new Date(
    Date.now() + (searchType === "album" ? 14 : 4) * 24 * 60 * 60 * 1000,
  ).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (getSupabaseAdmin() as any)
    .from("music_search_cache")
    .upsert(
      {
        search_type: searchType,
        normalized_query: query,
        response: candidates,
        expires_at: expiresAt,
      },
      { onConflict: "search_type,normalized_query" },
    );
}

async function searchYouTube(
  apiKey: string,
  parameters: Record<string, string>,
) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet",
    maxResults: "25",
    key: apiKey,
    ...parameters,
  }).toString();
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error("service_unavailable");
  const body = (await response.json()) as { items?: YouTubeSearchItem[] };
  return body.items ?? [];
}

function albumVideoMarker(title: string) {
  return /\b(?:full|complete|official|visual)\s+album\b|\balbum\b/i.test(title);
}

export async function searchYouTubeMusic(
  searchType: "album" | "track",
  title: string,
  artist: string,
  albumTitle?: string,
) {
  const intent =
    searchType === "album" ? albumIntent(title, artist) : { title, artist };
  const query = cacheKey(searchType, intent.title, intent.artist, albumTitle ?? "");
  const cached = await fromCache(searchType, query);
  if (cached) return { candidates: cached, cached: true };

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("service_unavailable");
  const requestQuery = [
    intent.artist,
    intent.title,
    albumTitle,
    searchType === "album" ? "album" : "audio",
  ]
    .filter(Boolean)
    .join(" ");
  // The Data API has no dedicated YouTube Music album entity. For albums, we
  // inspect two sets of long music videos: a precise "full album" search and
  // a broader fallback. Playlists are deliberately excluded: even playlists
  // from a music channel can be user-curated rather than actual albums.
  const items =
    searchType === "album"
      ? await Promise.all([
          searchYouTube(apiKey, {
            q: `${intent.artist} ${intent.title} full album`.trim(),
            type: "video",
            videoCategoryId: "10",
            videoDuration: "long",
          }),
          searchYouTube(apiKey, {
            q: requestQuery,
            type: "video",
            videoCategoryId: "10",
            videoDuration: "long",
          }),
        ]).then(([preciseVideos, fallbackVideos]) => [
          ...preciseVideos,
          ...fallbackVideos,
        ])
      : await searchYouTube(apiKey, { q: requestQuery, type: "video" });
  const candidates = items
    .flatMap((item): MusicCandidate[] => {
      const resourceType: MusicResourceType | null = item.id?.playlistId
        ? "playlist"
        : item.id?.videoId
          ? "video"
          : null;
      const resourceId = item.id?.playlistId ?? item.id?.videoId ?? null;
      const rawTitle = item.snippet?.title?.trim() ?? "";
      if (!resourceType || !resourceId || !rawTitle) return [];
      const channelTitle = item.snippet?.channelTitle?.trim() ?? "";
      const thumbnailUrl =
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        null;
      const detectedArtist =
        intent.artist ||
        artistInCandidate(rawTitle) ||
        channelTitle.replace(/\s*[-–—]\s*(topic|vevo)$/i, "").trim();
      const candidateTitle =
        searchType === "album" && intent.title
          ? intent.title
          : cleanAlbumTitle(rawTitle);
      if (
        searchType === "album" &&
        !isLikelyAlbumResult({
          title: intent.title,
          artist: intent.artist,
          candidateTitle: rawTitle,
          candidateArtist: detectedArtist,
          channelTitle,
          resourceType,
        })
      ) {
        return [];
      }
      const baseScore = scoreMusicCandidate({
        title: intent.title,
        artist: intent.artist,
        candidateTitle: rawTitle,
        candidateArtist: detectedArtist,
        channelTitle,
        resourceType,
        thumbnailUrl,
      });
      const score = Math.min(
        100,
        baseScore +
          (searchType === "album" && resourceType === "video" ? 10 : 0) +
          (searchType === "album" && albumVideoMarker(rawTitle) ? 12 : 0) +
          (searchType === "album" && /\b(?:topic|official|vevo|records|music)\b/i.test(channelTitle) ? 8 : 0),
      );
      if (searchType === "album" && score < 60) return [];
      const urls = musicUrls(resourceType, resourceId, requestQuery);
      return [
        {
          id: `${resourceType}:${resourceId}`,
          title: candidateTitle,
          artist: detectedArtist,
          channelTitle,
          thumbnailUrl,
          resourceType,
          resourceId,
          ...urls,
          itemCount: null,
          score,
          confidence: classifyConfidence(score),
          source: "youtube_search",
        },
      ];
    })
    .sort((left, right) => right.score - left.score)
    .filter((candidate, index, all) =>
      all.findIndex((other) => other.id === candidate.id) === index,
    )
    .slice(0, 5);
  await storeCache(searchType, query, candidates);
  return { candidates, cached: false };
}

export async function isEntryEditor(entryId: string, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = getSupabaseAdmin();
  const [{ data: entry }, { data: profile }] = await Promise.all([
    supabase
      .from("club_draw_entries")
      .select("id, proposed_by, music_metadata_locked")
      .eq("id", entryId)
      .maybeSingle(),
    supabase
      .from("member_profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (!entry) return { allowed: false, isAdmin: false, locked: false };
  const isAdmin = profile?.role === "admin";
  return {
    allowed: isAdmin || entry.proposed_by === userId,
    isAdmin,
    locked: entry.music_metadata_locked === true,
  };
}
