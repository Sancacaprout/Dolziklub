const pendingArchiveReviewIds = new Set(["archive-29", "archive-42"]);

export function sourceArchiveReviewId(albumId: string) {
  return albumId;
}

export function displayArchiveReviewId(storageAlbumId: string) {
  return storageAlbumId;
}

export function isPendingArchiveReview(albumId: string) {
  return pendingArchiveReviewIds.has(albumId);
}
