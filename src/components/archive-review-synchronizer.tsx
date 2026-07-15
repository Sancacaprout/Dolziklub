"use client";

import { useEffect } from "react";

type SyncedReview = {
  rating: number | null;
  text: string | null;
  bestTrack: string | null;
  worstTrack: string | null;
  artist: string;
  album: string;
};

const musicSearch = (track: string, artist: string, album: string) =>
  `https://music.youtube.com/search?q=${encodeURIComponent(`${track} ${artist} ${album}`)}`;

function replaceTrack(card: Element, track: string | null, review: SyncedReview) {
  const label = card.querySelector("span");
  if (!label) return;

  for (const element of Array.from(card.children)) {
    if (element !== label) element.remove();
  }

  if (!track) {
    const empty = document.createElement("p");
    empty.textContent = "Pas encore renseigné";
    card.append(empty);
    return;
  }

  const link = document.createElement("a");
  link.href = musicSearch(track, review.artist, review.album);
  link.target = "_blank";
  link.rel = "noreferrer";
  link.append(document.createTextNode(track));
  const small = document.createElement("small");
  small.textContent = "Écouter sur YouTube Music ↗";
  link.append(small);
  card.append(link);
}

function applyReview(review: SyncedReview) {
  const rating = document.querySelector<HTMLElement>(".album-sheet__info .rating");
  if (rating) {
    if (review.rating === null) {
      rating.className = "rating rating--pending sheet-pending";
      rating.textContent = "EN ATTENTE";
    } else {
      rating.className = "rating";
      rating.replaceChildren(document.createTextNode(`${review.rating.toFixed(1).replace(".", ",")} `));
      const suffix = document.createElement("small");
      suffix.textContent = "/ 5";
      rating.append(suffix);
    }
  }

  const status = document.querySelector<HTMLElement>(".album-sheet__info dl div:nth-child(3) dd");
  if (status) status.textContent = review.rating === null ? "Compte rendu encore scellé" : "Écouté et évalué";

  const quote = document.querySelector<HTMLElement>(".review-quote blockquote");
  if (quote) quote.textContent = review.text || "Le compte rendu est encore sous scellés.";
  document.querySelector(".review-quote .review-detail")?.remove();

  const best = document.querySelector(".track-card--best");
  const worst = document.querySelector(".track-card--worst");
  if (best) replaceTrack(best, review.bestTrack, review);
  if (worst) replaceTrack(worst, review.worstTrack, review);
}

export function ArchiveReviewSynchronizer({ slug }: { slug: string }) {
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/archive-reviews/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { review: SyncedReview | null } | null) => {
        if (payload?.review) applyReview(payload.review);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [slug]);

  return null;
}
