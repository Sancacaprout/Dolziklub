import assert from "node:assert/strict";
import test from "node:test";
import { getReviewPreview, REVIEW_PREVIEW_WORD_LIMIT } from "../src/lib/review-preview";

test("keeps a review of twenty words or fewer intact", () => {
  const review = Array.from({ length: REVIEW_PREVIEW_WORD_LIMIT }, (_, index) => `mot${index + 1}`).join(" ");

  assert.deepEqual(getReviewPreview(review), { text: review, truncated: false });
});

test("limits a longer review to twenty words", () => {
  const review = Array.from({ length: REVIEW_PREVIEW_WORD_LIMIT + 3 }, (_, index) => `mot${index + 1}`).join(" ");
  const result = getReviewPreview(review);

  assert.equal(result.truncated, true);
  assert.equal(result.text, `${Array.from({ length: REVIEW_PREVIEW_WORD_LIMIT }, (_, index) => `mot${index + 1}`).join(" ")}…`);
});
