import { isSameMemberIdentity } from "@/data/members";
import type { Album } from "@/types/album";

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const verdictRatings = (album: Album) => album.globalReviews
  ? album.globalReviews.flatMap((review) => review.rating === null ? [] : [review.rating])
  : album.rating === null ? [] : [album.rating];

export function getClubStats(albums: Album[]) {
  const ratings = albums.flatMap(verdictRatings);
  const verdictSlots = albums.reduce((total, album) => total + (album.globalReviews?.length ?? 1), 0);
  const averageRating = average(ratings);
  return {
    total: albums.length,
    rated: ratings.length,
    pending: albums.filter((album) => album.globalReviews ? album.globalReviews.some((review) => review.rating === null) : album.status === "pending").length,
    averageRating,
    completionRate: verdictSlots ? (ratings.length / verdictSlots) * 100 : 0,
    distribution: Array.from({ length: 11 }, (_, index) => index / 2).map((score) => ({
      score,
      count: ratings.filter((rating) => rating === score).length,
    })),
  };
}

export function getMemberStats(albums: Album[], slug: string) {
  const belongsToMember = (name: string | null) => isSameMemberIdentity(name, slug);
  const proposed = albums.filter((album) => belongsToMember(album.proposedBy));
  const listened = albums.flatMap((album) => {
    if (!album.globalReviews) return belongsToMember(album.listenedBy) ? [album] : [];
    return album.globalReviews
      .filter((review) => belongsToMember(review.listenedBy))
      .map((review) => ({
        ...album,
        id: `${album.id}:review:${review.entryId}`,
        slug: `live-${review.entryId}`,
        liveEntryId: review.entryId,
        listenedBy: review.listenedBy,
        rating: review.rating,
        shortReview: review.shortReview,
        detailedReview: review.detailedReview,
        bestTrack: review.bestTrack,
        worstTrack: review.worstTrack,
        status: review.rating === null ? "pending" as const : "rated" as const,
        globalReviews: undefined,
      }));
  });
  return {
    proposed,
    listened,
    givenAverage: average(listened.flatMap((album) => album.rating === null ? [] : [album.rating])),
    receivedAverage: average(proposed.flatMap(verdictRatings)),
  };
}

export function sortAlbums(albums: Album[], sort: "title" | "rating") {
  return [...albums].sort((a, b) => sort === "rating" ? (b.rating ?? -1) - (a.rating ?? -1) : a.title.localeCompare(b.title, "fr"));
}