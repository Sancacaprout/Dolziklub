import test from "node:test";
import assert from "node:assert/strict";

import {
  displayArchiveReviewId,
  isPendingArchiveReview,
  sourceArchiveReviewId,
} from "../src/lib/archive-review-alignment";

test("realigns imported archive reviews around missing source rows", () => {
  assert.equal(displayArchiveReviewId("archive-27"), "archive-28");
  assert.equal(displayArchiveReviewId("archive-29"), "archive-30");
  assert.equal(displayArchiveReviewId("archive-35"), "archive-36");
  assert.equal(displayArchiveReviewId("archive-38"), "archive-39");
  assert.equal(displayArchiveReviewId("archive-40"), "archive-41");
  assert.equal(displayArchiveReviewId("archive-42"), "archive-42");
});

test("keeps source-less albums pending", () => {
  assert.equal(sourceArchiveReviewId("archive-27"), null);
  assert.equal(sourceArchiveReviewId("archive-29"), null);
  assert.equal(sourceArchiveReviewId("archive-38"), null);
  assert.equal(isPendingArchiveReview("archive-27"), true);
  assert.equal(isPendingArchiveReview("archive-30"), false);
});

test("uses the inverse mapping for a card read or edit", () => {
  assert.equal(sourceArchiveReviewId("archive-28"), "archive-27");
  assert.equal(sourceArchiveReviewId("archive-30"), "archive-29");
  assert.equal(sourceArchiveReviewId("archive-36"), "archive-35");
  assert.equal(sourceArchiveReviewId("archive-39"), "archive-38");
  assert.equal(sourceArchiveReviewId("archive-41"), "archive-40");
  assert.equal(sourceArchiveReviewId("archive-42"), "archive-42");
});
