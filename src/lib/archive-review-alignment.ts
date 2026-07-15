const pendingArchiveReviewIds = new Set([
  "archive-27",
  "archive-29",
  "archive-38",
]);

function archiveNumber(albumId: string) {
  const match = /^archive-(\d+)$/.exec(albumId);
  return match ? Number(match[1]) : null;
}

export function sourceArchiveReviewId(albumId: string) {
  if (pendingArchiveReviewIds.has(albumId)) return null;

  const number = archiveNumber(albumId);
  if (number === null) return albumId;
  if ((number >= 28 && number <= 36) || (number >= 39 && number <= 41)) return `archive-${number - 1}`;
  return albumId;
}

export function displayArchiveReviewId(storageAlbumId: string) {
  const number = archiveNumber(storageAlbumId);
  if (number === null) return storageAlbumId;
  if ((number >= 27 && number <= 35) || (number >= 38 && number <= 40)) return `archive-${number + 1}`;
  return storageAlbumId;
}

export function isPendingArchiveReview(albumId: string) {
  return pendingArchiveReviewIds.has(albumId);
}
