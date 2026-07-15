"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type PlayerItem = { title: string; artist: string; sourceUrl: string; externalUrl: string };
type PlayerContextValue = { openChoice: (item: PlayerItem) => void };
const MusicPlayerContext = createContext<PlayerContextValue | null>(null);

function embedUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const list = url.searchParams.get("list");
    const video = url.searchParams.get("v");
    if (video) {
      const params = new URLSearchParams({ autoplay: "1", playsinline: "1", rel: "0" });
      if (list) params.set("list", list);
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video)}?${params}`;
    }
    if (list) return `https://www.youtube-nocookie.com/embed/videoseries?${new URLSearchParams({ list, autoplay: "1", playsinline: "1", rel: "0" })}`;
  } catch { /* The external link remains available even if it is malformed. */ }
  return null;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<PlayerItem | null>(null);
  const [playing, setPlaying] = useState<PlayerItem | null>(null);
  const playableUrl = useMemo(() => choice && embedUrl(choice.sourceUrl), [choice]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setChoice(null); setPlaying(null); } };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  return <MusicPlayerContext.Provider value={{ openChoice: setChoice }}>
    {children}
    {choice && <div className="music-choice" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setChoice(null); }}><section className="music-choice__dialog" role="dialog" aria-modal="true" aria-labelledby="music-choice-title"><button className="music-choice__close" type="button" onClick={() => setChoice(null)} aria-label="Fermer">×</button><p className="eyebrow">CHOISIR L’ÉCOUTE</p><h2 id="music-choice-title">{choice.title}</h2><p>{choice.artist}</p><div className="music-choice__actions"><a className="music-choice__external" href={choice.externalUrl} target="_blank" rel="noopener noreferrer" onClick={() => setChoice(null)}>Ouvrir YouTube Music <span aria-hidden="true">↗</span></a>{playableUrl ? <button className="music-choice__player" type="button" onClick={() => { setPlaying(choice); setChoice(null); }}>Lire dans le Klub <span aria-hidden="true">▶</span></button> : <p className="music-choice__unavailable">Le lecteur intégré nécessite un lien YouTube validé pour ce morceau. YouTube Music reste disponible.</p>}</div></section></div>}
    {playing && <aside className="club-player" aria-label={`Lecteur de ${playing.title}`}><div className="club-player__bar"><div><span>LECTEUR DU KLUB</span><b>{playing.title}</b><small>{playing.artist}</small></div><button type="button" onClick={() => setPlaying(null)} aria-label="Fermer le lecteur">×</button></div><iframe title={`YouTube : ${playing.title}`} src={embedUrl(playing.sourceUrl) ?? undefined} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></aside>}
  </MusicPlayerContext.Provider>;
}

export function MusicChoiceButton({ title, artist, sourceUrl, externalUrl, className, children }: PlayerItem & { className?: string; children: ReactNode }) {
  const player = useContext(MusicPlayerContext);
  if (!player) throw new Error("MusicChoiceButton must be rendered within MusicPlayerProvider.");
  return <button className={className} type="button" onClick={() => player.openChoice({ title, artist, sourceUrl, externalUrl })}>{children}</button>;
}