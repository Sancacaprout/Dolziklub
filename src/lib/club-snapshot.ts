import "server-only";

import { unstable_cache } from "next/cache";

import { getLatestLiveAlbums, getSynchronizedAlbums } from "@/lib/live-albums";
import { getSynchronizedMembers } from "@/lib/public-members";
import { getClubStats } from "@/lib/statistics";

async function loadClubSnapshot() {
  const [albums, currentAlbums, members] = await Promise.all([
    getSynchronizedAlbums(),
    getLatestLiveAlbums(24),
    getSynchronizedMembers(),
  ]);
  const stats = getClubStats(albums);
  const currentDrawNumber = currentAlbums[0]?.drawNumber ?? null;
  const archivedAlbums = albums.filter((album) =>
    !album.id.startsWith("live-") || album.drawNumber !== currentDrawNumber,
  ).length;

  return {
    albums,
    currentAlbums,
    members,
    archivedAlbums,
    indexedAlbums: albums.length,
    stats,
  };
}

export const getClubSnapshot = unstable_cache(
  loadClubSnapshot,
  ["club-snapshot-v1"],
  { revalidate: 20, tags: ["club-data"] },
);
