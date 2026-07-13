import type { Album } from "@/types/album";

const rated = (albums: Album[]) => albums.filter((album) => album.rating !== null && album.rating > 0);
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function getClubStats(albums: Album[]) {
  const scored = rated(albums);
  const averageRating = average(scored.map((album) => album.rating!));
  return {
    total: albums.length,
    rated: scored.length,
    pending: albums.filter((album) => album.status === "pending").length,
    averageRating,
    completionRate: albums.length ? (scored.length / albums.length) * 100 : 0,
    distribution: [1, 2, 3, 4, 5].map((score) => ({ score, count: scored.filter((album) => Math.floor(album.rating!) === score).length })),
  };
}

export function getMemberStats(albums: Album[], slug: string) {
  const proposed = albums.filter((album) => album.proposedBy === slug);
  const listened = albums.filter((album) => album.listenedBy === slug);
  return {
    proposed,
    listened,
    givenAverage: average(rated(listened).map((album) => album.rating!)),
    receivedAverage: average(rated(proposed).map((album) => album.rating!)),
  };
}

export function sortAlbums(albums: Album[], sort: "title" | "rating") {
  return [...albums].sort((a, b) => sort === "rating" ? (b.rating ?? -1) - (a.rating ?? -1) : a.title.localeCompare(b.title, "fr"));
}
