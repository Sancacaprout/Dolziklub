import archive from "./albums.generated.json";
import { uniqueSlug } from "@/lib/slug";
import type { Album } from "@/types/album";

type ArchiveRecord = Omit<Album, "id" | "slug"> & { position: number };

const usedSlugs = new Set<string>();

// The supplied club archive is chronological: the last record is the newest.
export const albums: Album[] = (archive as ArchiveRecord[]).map(({ position, ...album }) => ({
  ...album,
  id: `archive-${position}`,
  slug: uniqueSlug(`${album.title}-${album.artist}`, usedSlugs),
}));

export const getLatestAlbums = (limit: number) => [...albums].slice(-limit).reverse();

export function getAlbum(slug: string) {
  return albums.find((album) => album.slug === slug);
}
