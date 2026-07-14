export type MatchConfidence = "high" | "medium" | "low";

export type MusicResourceType = "playlist" | "video" | "search";

export type MusicCandidate = {
  id: string;
  title: string;
  artist: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  resourceType: MusicResourceType;
  resourceId: string | null;
  youtubeMusicUrl: string;
  youtubeUrl: string;
  itemCount: number | null;
  confidence: MatchConfidence;
  score: number;
  source: "youtube_search" | "deezer_search";
};

const noiseWords = new Set(["official", "audio", "video", "full", "album", "playlist", "music", "topic"]);
const weakerWords = ["reaction", "review", "cover", "slowed", "reverb", "nightcore", "remix", "instrumental", "lyrics", "live", "sped up"];
const albumOnlyRejectedWords = ["react", "review", "cover", "slowed", "reverb", "nightcore", "remix", "lyrics", "live", "sped up", "mix"];

export function normalizeMusicText(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’'`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function terms(input: string) {
  return normalizeMusicText(input).split(" ").filter(Boolean);
}

function overlap(left: string, right: string) {
  const a = terms(left).filter((term) => !noiseWords.has(term));
  const b = new Set(terms(right));
  if (!a.length || !b.size) return 0;
  return a.filter((term) => b.has(term)).length / a.length;
}

function includesExact(left: string, right: string) {
  const a = normalizeMusicText(left);
  const b = normalizeMusicText(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

export function classifyConfidence(score: number): MatchConfidence {
  if (score >= 78) return "high";
  if (score >= 48) return "medium";
  return "low";
}

export function scoreMusicCandidate(input: { title: string; artist: string; resourceType: MusicResourceType; channelTitle?: string; candidateTitle: string; candidateArtist?: string; thumbnailUrl?: string | null; itemCount?: number | null }) {
  const searchable = `${input.candidateTitle} ${input.candidateArtist ?? ""} ${input.channelTitle ?? ""}`;
  let score = overlap(input.title, input.candidateTitle) * 45;
  score += overlap(input.artist, searchable) * 30;
  if (includesExact(input.title, input.candidateTitle)) score += 12;
  if (includesExact(input.artist, searchable)) score += 8;
  if (input.resourceType === "playlist") score += 2;
  if (input.resourceType === "video") score += 7;
  if (/\b(topic|official)\b/i.test(input.channelTitle ?? "")) score += 6;
  if (input.thumbnailUrl) score += 3;
  if (input.itemCount && input.itemCount > 1 && input.itemCount < 80) score += 3;
  if (weakerWords.some((word) => normalizeMusicText(searchable).includes(word))) score -= 13;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isLikelyAlbumResult(input: {
  title: string;
  artist: string;
  candidateTitle: string;
  candidateArtist?: string;
  channelTitle?: string;
  resourceType: Extract<MusicResourceType, "playlist" | "video">;
}) {
  const candidateTitle = normalizeMusicText(input.candidateTitle);
  const expectedTitle = normalizeMusicText(input.title);
  const artistHaystack = normalizeMusicText(
    `${input.candidateArtist ?? ""} ${input.channelTitle ?? ""} ${input.candidateTitle}`,
  );
  const expectedArtist = normalizeMusicText(input.artist);
  const titleMatches = Boolean(expectedTitle) && candidateTitle.includes(expectedTitle);
  const artistMatches = !expectedArtist || artistHaystack.includes(expectedArtist);
  const rejected = albumOnlyRejectedWords.some((word) => candidateTitle.includes(word));
  const albumMarked = /\b(?:full|complete|official|visual) album\b|\balbum\b/.test(candidateTitle);
  const officialChannel = /\b(?:topic|official|vevo|records|music)\b/.test(
    normalizeMusicText(input.channelTitle ?? ""),
  );

  if (!titleMatches || !artistMatches || rejected) return false;
  // YouTube's Data API does not distinguish an album playlist from a user
  // playlist reliably enough. Albums are therefore selected only from long
  // music videos, which also gives us one stable cover and direct Music URL.
  if (input.resourceType === "playlist") return false;
  return albumMarked || officialChannel || (titleMatches && artistMatches);
}

export function isLikelyCatalogAlbumResult(input: {
  title: string;
  artist: string;
  candidateTitle: string;
  candidateArtist: string;
}) {
  const expectedTitle = normalizeMusicText(input.title);
  const candidateTitle = normalizeMusicText(input.candidateTitle);
  const expectedArtist = normalizeMusicText(input.artist);
  const candidateArtist = normalizeMusicText(input.candidateArtist);
  if (!expectedTitle || !candidateTitle) return false;

  // Catalogues may add edition details after the canonical album title, but a
  // partial substring match would let unrelated releases into the chooser.
  const titleMatches =
    candidateTitle === expectedTitle ||
    candidateTitle.startsWith(`${expectedTitle} `) ||
    expectedTitle.startsWith(`${candidateTitle} `);
  const artistMatches =
    !expectedArtist ||
    candidateArtist === expectedArtist ||
    candidateArtist.includes(expectedArtist) ||
    expectedArtist.includes(candidateArtist);
  return titleMatches && artistMatches;
}

export function musicUrls(resourceType: MusicResourceType, resourceId: string | null, query: string) {
  const safeQuery = encodeURIComponent(query.trim());
  if (!resourceId || resourceType === "search") {
    return { youtubeMusicUrl: `https://music.youtube.com/search?q=${safeQuery}`, youtubeUrl: `https://www.youtube.com/results?search_query=${safeQuery}` };
  }
  if (resourceType === "playlist") {
    return { youtubeMusicUrl: `https://music.youtube.com/playlist?list=${encodeURIComponent(resourceId)}`, youtubeUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(resourceId)}` };
  }
  return { youtubeMusicUrl: `https://music.youtube.com/watch?v=${encodeURIComponent(resourceId)}`, youtubeUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(resourceId)}` };
}

export function cacheKey(searchType: "album" | "track", ...parts: string[]) {
  return `${searchType}:v5:${parts.map(normalizeMusicText).join("|")}`;
}
