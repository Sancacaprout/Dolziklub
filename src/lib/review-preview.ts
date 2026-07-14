export const REVIEW_PREVIEW_WORD_LIMIT = 20;

export function getReviewPreview(value: string | null | undefined) {
  const review = value?.trim() ?? "";
  const words = review.split(/\s+/).filter(Boolean);

  if (words.length <= REVIEW_PREVIEW_WORD_LIMIT) {
    return { text: review, truncated: false };
  }

  return {
    text: `${words.slice(0, REVIEW_PREVIEW_WORD_LIMIT).join(" ")}…`,
    truncated: true,
  };
}
