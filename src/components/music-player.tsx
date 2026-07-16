"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type TrackItem = { title: string; artist: string; albumTitle?: string; youtubeMusicUrl?: string; sourceUrl?: string; externalUrl?: string };
type DeezerTrack = { id: number; title: string; artist: string; album: string | null; url: string };
type PlayerContextValue = { openTrack: (item: TrackItem) => void };
const MusicPlayerContext = createContext<PlayerContextValue | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<TrackItem | null>(null);
  const [playing, setPlaying] = useState<DeezerTrack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const renameHeaders = () => document.querySelectorAll("th").forEach((header) => {
      const label = header.textContent?.trim();
      if (label === "Morceau le plus convaincant") header.textContent = "Best track";
      if (label === "Morceau le moins convaincant") header.textContent = "Worst track";
    });
    renameHeaders();
    const observer = new MutationObserver(renameHeaders);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setChoice(null); setPlaying(null); setError(""); } };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  const playInClub = async () => {
    if (!choice || loading) return;
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ title: choice.title, artist: choice.artist, ...(choice.albumTitle ? { album: choice.albumTitle } : {}) });
      const response = await fetch(`/api/music/deezer-track?${query}`);
      const payload = await response.json().catch(() => null) as { track?: DeezerTrack; error?: string } | null;
      if (!response.ok || !payload?.track) throw new Error(payload?.error ?? "Ce morceau n’a pas été trouvé dans Deezer.");
      setPlaying(payload.track); setChoice(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Le lecteur Deezer est indisponible."); }
    finally { setLoading(false); }
  };
  return <MusicPlayerContext.Provider value={{ openTrack: (track) => { setChoice(track); setError(""); } }}>
    {children}
    {choice && <div className="music-choice" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) setChoice(null); }}><section className="music-choice__dialog" role="dialog" aria-modal="true" aria-labelledby="music-choice-title"><button className="music-choice__close" type="button" onClick={() => setChoice(null)} aria-label="Fermer">×</button><p className="eyebrow">CHOISIR L’ÉCOUTE</p><h2 id="music-choice-title">{choice.title}</h2><p>{choice.artist}{choice.albumTitle ? ` · ${choice.albumTitle}` : ""}</p><div className="music-choice__actions"><a className="music-choice__external" href={choice.youtubeMusicUrl ?? choice.externalUrl ?? choice.sourceUrl ?? "https://music.youtube.com"} target="_blank" rel="noopener noreferrer" onClick={() => setChoice(null)}>Ouvrir YouTube Music <span aria-hidden="true">↗</span></a><button className="music-choice__player" type="button" disabled={loading} onClick={() => void playInClub()}>{loading ? "Recherche Deezer…" : "Écouter dans le Klub"}<span aria-hidden="true">▶</span></button>{error && <p className="music-choice__unavailable">{error}</p>}<small className="music-choice__preview">Le lecteur Deezer officiel diffuse un extrait musical.</small></div></section></div>}
    {playing && <aside className="club-player" aria-label={`Lecteur Deezer de ${playing.title}`}><div className="club-player__bar"><div><span>LECTEUR DEEZER · EXTRAIT</span><b>{playing.title}</b><small>{playing.artist}</small></div><button type="button" onClick={() => setPlaying(null)} aria-label="Fermer le lecteur">×</button></div><iframe title={`Deezer : ${playing.title}`} src={`https://widget.deezer.com/widget/dark/track/${playing.id}?tracklist=false`} allow="autoplay; encrypted-media; clipboard-write" loading="eager" referrerPolicy="strict-origin-when-cross-origin" /><a className="club-player__deezer-link" href={playing.url || `https://www.deezer.com/track/${playing.id}`} target="_blank" rel="noopener noreferrer">Ouvrir directement dans Deezer <span aria-hidden="true">↗</span></a></aside>}
  </MusicPlayerContext.Provider>;
}

export function MusicTrackChoiceButton({ title, artist, albumTitle, youtubeMusicUrl, sourceUrl, externalUrl, className, children }: TrackItem & { className?: string; children: ReactNode }) {
  const player = useContext(MusicPlayerContext);
  if (!player) throw new Error("MusicTrackChoiceButton must be rendered within MusicPlayerProvider.");
  return <button className={className} type="button" onClick={() => player.openTrack({ title, artist, albumTitle, youtubeMusicUrl, sourceUrl, externalUrl })}>{children}</button>;
}
export function MusicChoiceButton({ title, artist, sourceUrl, externalUrl, className, children }: { title: string; artist: string; sourceUrl: string; externalUrl: string; className?: string; children: ReactNode }) {
  if (className === "album-title-link" || className === "music-link") return <a className={className} href={externalUrl} target="_blank" rel="noreferrer">{children}</a>;
  return <MusicTrackChoiceButton title={title} artist={artist} youtubeMusicUrl={externalUrl || sourceUrl} className={className}>{children}</MusicTrackChoiceButton>;
}