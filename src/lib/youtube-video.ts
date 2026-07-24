const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/;

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

export function isYouTubeVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && youtubeVideoIdPattern.test(value);
}

export function parseYouTubeVideoId(value: string): string | null {
  const input = value.trim();
  if (!input || input.length > 2048) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (youtubeHosts.has(host)) {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed") {
        candidate = parts[1] ?? null;
      }
    }
  }

  return isYouTubeVideoId(candidate) ? candidate : null;
}

export function youtubePrivacyEmbedUrl(videoId: string) {
  if (!isYouTubeVideoId(videoId)) throw new Error("Invalid YouTube video id");
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function youtubeWatchUrl(videoId: string) {
  if (!isYouTubeVideoId(videoId)) throw new Error("Invalid YouTube video id");
  return `https://www.youtube.com/watch?v=${videoId}`;
}
