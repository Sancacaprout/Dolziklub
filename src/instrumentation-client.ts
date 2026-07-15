type VerdictPayload = {
  review: {
    title: string | null;
    text: string | null;
  } | null;
};

const delayedRuns = [0, 180, 600, 1400];

function currentAlbumSlug() {
  const match = window.location.pathname.match(/^\/albums\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function renderVerdict(review: NonNullable<VerdictPayload["review"]>) {
  const quote = document.querySelector<HTMLElement>(".review-quote blockquote");
  if (!quote) return;

  quote.textContent = review.title || review.text || "Le compte rendu est encore scellé.";
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

async function synchronizeVerdict() {
  const slug = currentAlbumSlug();
  if (!slug) return;

  try {
    const response = await fetch(`/api/archive-review-titles/${encodeURIComponent(slug)}`);
    if (!response.ok) return;
    const payload = (await response.json()) as VerdictPayload;
    if (payload.review) renderVerdict(payload.review);
  } catch {
    // L'affichage statique reste disponible si la synchronisation échoue.
  }
}

function scheduleVerdictSynchronization() {
  for (const delay of delayedRuns) {
    window.setTimeout(() => void synchronizeVerdict(), delay);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleVerdictSynchronization, { once: true });
} else {
  scheduleVerdictSynchronization();
}

export function onRouterTransitionStart() {
  scheduleVerdictSynchronization();
}
