export function youtubeMusicSearchUrl(...parts: Array<string | null | undefined>) {
  const query = parts.filter((part): part is string => Boolean(part?.trim())).join(" ");
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
}
