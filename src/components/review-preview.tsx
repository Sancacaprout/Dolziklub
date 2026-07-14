"use client";

import { useState } from "react";
import { getReviewPreview } from "@/lib/review-preview";

export function ReviewPreview({ review }: { review: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const value = review?.trim();

  if (!value || /^avis\s+à\s+compléter$/i.test(value)) {
    return <span className="sheet-track-empty">—</span>;
  }

  const preview = getReviewPreview(value);
  const visibleReview = expanded || !preview.truncated ? value : preview.text;

  return (
    <div className="review-preview">
      <p>{visibleReview}</p>
      {preview.truncated && (
        <button
          type="button"
          className="review-preview__toggle"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((current) => !current);
          }}
        >
          {expanded ? "Réduire l’avis" : "Lire l’avis complet"}
        </button>
      )}
    </div>
  );
}
