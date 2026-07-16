import type { Album } from "@/types/album";
import { slugify } from "@/lib/slug";

export function albumIdentityKey(title: string, artist: string) {
  return `${slugify(title)}|${slugify(artist)}`;
}

export function findArchiveAlbumMatch(
  archiveAlbums: Album[],
  title: string,
  artist: string,
) {
  const identity = albumIdentityKey(title, artist);
  return archiveAlbums.find(
    (album) => albumIdentityKey(album.title, album.artist) === identity,
  );
}
