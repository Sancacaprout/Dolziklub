import manifest from "./manifest_pochettes.json";
import { uniqueSlug } from "@/lib/slug";
import type { Album } from "@/types/album";

type ManifestEntry = { album: string; artiste: string; fichier: string };
const usedSlugs = new Set<string>();

export const albums: Album[] = (manifest as ManifestEntry[]).map((entry, index) => ({
  id: `archive-${index + 1}`,
  slug: uniqueSlug(`${entry.album}-${entry.artiste}`, usedSlugs),
  title: entry.album,
  artist: entry.artiste,
  cover: `/covers/${entry.fichier}`,
  releaseYear: null,
  origin: null,
  language: null,
  genres: [],
  projectType: null,
  proposedBy: null,
  listenedBy: null,
  rating: null,
  shortReview: null,
  detailedReview: null,
  bestTrack: { title: null, url: null },
  worstTrack: { title: null, url: null },
  albumUrl: null,
  artistDescription: null,
  albumDescription: null,
  status: "pending",
}));

export function getAlbum(slug: string) {
  return albums.find((album) => album.slug === slug);
}
