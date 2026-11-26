export const memeChangedEvent = "dolziklub:meme-changed";

export function notifyMemeChanged() {
  try { window.localStorage.setItem(memeChangedEvent, crypto.randomUUID()); } catch {}
}

export function MemeCommentCount({ count }: { count: number }) {
  return <><span aria-hidden="true">💬</span> {count === 0 ? "Aucun commentaire" : `${count} commentaire${count === 1 ? "" : "s"}`}</>;
}
