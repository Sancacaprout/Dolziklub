"use client";

import { useEffect } from "react";

type ArchiveTitleReview = { title: string | null; text: string | null };

function applyTitle(review: ArchiveTitleReview) {
  const quote = document.querySelector<HTMLElement>(".review-quote blockquote");
  if (!quote) return;

  quote.textContent = review.title || review.text || "Le compte rendu est encore sous scellés.";
  const existingDetail = document.querySelector<HTMLElement>(".review-quote .review-detail");
  if (review.title && review.text) {
    const detail = existingDetail ?? document.createElement("p");
    detail.className = "review-detail";
    detail.textContent = review.text;
    if (!existingDetail) quote.insertAdjacentElement("afterend", detail);
  } else {
    existingDetail?.remove();
  }
}

export function ArchiveReviewTitleSynchronizer({ slug }: { slug: string }) {
  useEffect(() => {
    const controller = new AbortController();
    let observer: MutationObserver | undefined;

    fetch(`/api/archive-review-titles/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { review: ArchiveTitleReview | null } | null) => {
        if (!payload?.review) return;
        applyTitle(payload.review);

        const quote = document.querySelector(".review-quote blockquote");
        if (!quote) return;
        observer = new MutationObserver(() => applyTitle(payload.review!));
        observer.observe(quote, { childList: true, characterData: true, subtree: true });
      })
      .catch(() => undefined);

    return () => {
      controller.abort();
      observer?.disconnect();
    };
  }, [slug]);

  return null;
}
