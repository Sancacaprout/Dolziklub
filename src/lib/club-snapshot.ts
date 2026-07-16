import "server-only";

import { getLatestLiveAlbums, getSynchronizedAlbums } from "@/lib/live-albums";
import { getSynchronizedMembers } from "@/lib/public-members";
import { getClubStats } from "@/lib/statistics";

export async function getClubSnapshot() {
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
