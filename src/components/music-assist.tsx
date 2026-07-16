"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { type MusicCandidate } from "@/lib/music-matching";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

async function musicRequest(path: string, body: Record<string, unknown>) {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  if (!data.session?.access_token) throw new Error("Connexion requise.");
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "La recherche est indisponible.");
  return payload as { candidates?: MusicCandidate[] };
}

function Confidence({ value }: { value: MusicCandidate["confidence"] }) {
  const label = value === "high" ? "Correspondance élevée" : value === "medium" ? "À vérifier" : "Correspondance faible";
  return <span className={`music-confidence music-confidence--${value}`}>{label}</span>;
}

function CandidateList({ candidates, selectedId, onSelect, compact = false }: { candidates: MusicCandidate[]; selectedId?: string; onSelect: (candidate: MusicCandidate) => void; compact?: boolean }) {
  return <div className={`music-results${compact ? " music-results--autocomplete" : ""}`} aria-live="polite">{candidates.map((candidate) => <article key={candidate.id} className={`music-candidate${selectedId === candidate.id ? " is-selected" : ""}`}>
    {candidate.thumbnailUrl ? <img src={candidate.thumbnailUrl} alt={`Pochette de ${candidate.title}`} /> : <span className="music-candidate__cover">DOL<br />ZIKLUB</span>}
    <div className="music-candidate__body"><div><Confidence value={candidate.confidence} /><b>{candidate.title}</b><span>— {candidate.artist || candidate.channelTitle}</span><small>{candidate.source === "deezer_search" ? `Album Deezer${candidate.itemCount ? ` · ${candidate.itemCount} morceaux` : ""}` : `${candidate.resourceType === "playlist" ? "Playlist" : "Vidéo"}${candidate.itemCount ? ` · ${candidate.itemCount} morceaux` : " · YouTube"}`}</small></div><div className="music-candidate__actions"><a className="sheet-entry-action" href={candidate.youtubeMusicUrl} target="_blank" rel="noopener noreferrer">Écouter ↗</a><button type="button" className="sheet-entry-action" onClick={() => onSelect(candidate)}>{selectedId === candidate.id ? "Choisi" : "Choisir"}</button></div></div>
  </article>)}</div>;
}

export function AlbumLookup({ title, artist, selected, onSelect, disabled }: { title: string; artist: string; selected: MusicCandidate | null; onSelect: (candidate: MusicCandidate | null) => void; disabled?: boolean }) {
  const [candidates, setCandidates] = useState<MusicCandidate[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);
  const requestId = useRef(0);
  const canSuggest = title.trim().length >= 3;
  const search = useCallback(async (automatic = false) => {
    if (title.trim().length < 3) {
      if (!automatic) {
        setState("error");
        setMessage("Écris au moins trois lettres du titre.");
      }
      return;
    }
    const currentRequest = ++requestId.current;
    setState("loading");
    setMessage("");
    try {
      const result = await musicRequest("/api/music/search-albums", { title, artist });
      if (currentRequest !== requestId.current) return;
      setCandidates(result.candidates ?? []);
      setState("idle");
      setMessage(result.candidates?.length ? "Choisis l’album correspondant." : "Aucun résultat fiable. Tu peux continuer manuellement.");
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setState("error");
      setMessage(error instanceof Error ? error.message : "La recherche est indisponible.");
    }
  }, [title, artist]);
  useEffect(() => {
    if (title.trim().length < 3) return;
    const timer = window.setTimeout(() => void search(true), 750);
    return () => window.clearTimeout(timer);
  }, [title, search]);
  return <section className="music-assist music-assist--autocomplete"><div className="music-assist__bar"><span className="eyebrow">ASSISTANCE MUSICALE</span><button type="button" className="music-assist__toggle" aria-expanded={expanded} aria-label={expanded ? "Replier l’assistance musicale" : "Déplier l’assistance musicale"} onClick={() => setExpanded((current) => !current)}>{expanded ? "−" : "+"}</button></div>{expanded && <div className="music-assist__details"><div className="music-assist__details-head"><p>Commence à écrire le titre : les albums apparaissent ici.</p><button type="button" className="sheet-entry-action" disabled={disabled || state === "loading" || !canSuggest} onClick={() => void search()}>{state === "loading" ? "Recherche…" : "Actualiser"}</button></div>{canSuggest && message && <p className={`music-assist__message${state === "error" ? " is-error" : ""}`}>{message}</p>}{canSuggest && candidates.length > 0 && <CandidateList compact candidates={candidates} selectedId={selected?.id} onSelect={onSelect} />}{canSuggest && (candidates.length > 0 || selected) && <button type="button" className="music-manual" onClick={() => onSelect(null)}>Aucun de ces résultats · renseigner manuellement</button>}</div>}</section>;
}
export function TrackLookup({ label, title, artist, albumTitle, selected, onTitleChange, onSelect, disabled }: { label: string; title: string; artist: string; albumTitle: string; selected: MusicCandidate | null; onTitleChange: (value: string) => void; onSelect: (candidate: MusicCandidate | null) => void; disabled?: boolean }) {
  const [candidates, setCandidates] = useState<MusicCandidate[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const search = useCallback(async () => {
    if (!title.trim()) {
      setState("idle");
      setMessage("");
      setCandidates([]);
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const result = await musicRequest("/api/music/search-tracks", { title, artist, albumTitle });
      setCandidates(result.candidates ?? []);
      setState("idle");
      setMessage(result.candidates?.length ? "Choisis le morceau qui correspond vraiment à ton verdict." : "Aucun résultat certain : tu peux garder le titre saisi sans lien.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "La recherche est indisponible.");
    }
  }, [albumTitle, artist, title]);
  useEffect(() => {
    if (!title.trim()) return;
    const timer = window.setTimeout(() => void search(), 650);
    return () => window.clearTimeout(timer);
  }, [search, title]);
  return <label className="track-lookup"><span>{label}</span><div className="track-lookup__input"><input disabled={disabled} maxLength={160} value={title} onChange={(event) => { onTitleChange(event.target.value); onSelect(null); }} placeholder={label === "Best track" ? "Ton meilleur morceau" : "Le morceau le moins convaincant"} /></div>{state === "loading" && <small>Recherche…</small>}{message && state !== "loading" && <small className={state === "error" ? "is-error" : ""}>{message}</small>}{candidates.length > 0 && <CandidateList candidates={candidates} selectedId={selected?.id} onSelect={(candidate) => { onTitleChange(candidate.title); onSelect(candidate); }} />}</label>;
}