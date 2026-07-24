"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { type MusicCandidate } from "@/lib/music-matching";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type DeezerTrackCandidate = {
  id: string;
  title: string;
  artist: string;
  albumTitle: string | null;
  coverUrl: string | null;
  deezerUrl: string;
};

async function musicRequest<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  if (!data.session?.access_token) throw new Error("Connexion requise.");

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "La recherche est indisponible.",
    );
  }
  return payload as T;
}

function Confidence({ value }: { value: MusicCandidate["confidence"] }) {
  const label =
    value === "high"
      ? "Correspondance élevée"
      : value === "medium"
        ? "À vérifier"
        : "Correspondance faible";
  return (
    <span className={`music-confidence music-confidence--${value}`}>
      {label}
    </span>
  );
}

function CandidateList({
  candidates,
  selectedId,
  onSelect,
  compact = false,
}: {
  candidates: MusicCandidate[];
  selectedId?: string;
  onSelect: (candidate: MusicCandidate) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`music-results${compact ? " music-results--autocomplete" : ""}`}
      aria-live="polite"
    >
      {candidates.map((candidate) => (
        <article
          key={candidate.id}
          className={`music-candidate${selectedId === candidate.id ? " is-selected" : ""}`}
        >
          {candidate.thumbnailUrl ? (
            <img
              src={candidate.thumbnailUrl}
              alt={`Pochette de ${candidate.title}`}
            />
          ) : (
            <span className="music-candidate__cover">
              DOL
              <br />
              ZIKLUB
            </span>
          )}
          <div className="music-candidate__body">
            <div>
              <Confidence value={candidate.confidence} />
              <b>{candidate.title}</b>
              <span>— {candidate.artist || candidate.channelTitle}</span>
              <small>
                {candidate.source === "deezer_search"
                  ? `Album Deezer${candidate.itemCount ? ` · ${candidate.itemCount} morceaux` : ""}`
                  : `${candidate.resourceType === "playlist" ? "Playlist" : "Vidéo"}${candidate.itemCount ? ` · ${candidate.itemCount} morceaux` : " · YouTube"}`}
              </small>
            </div>
            <div className="music-candidate__actions">
              <a
                className="sheet-entry-action"
                href={candidate.youtubeMusicUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {candidate.source === "deezer_search"
                  ? "Ouvrir dans Deezer ↗"
                  : "Écouter ↗"}
              </a>
              <button
                type="button"
                className="sheet-entry-action"
                onClick={() => onSelect(candidate)}
              >
                {selectedId === candidate.id ? "Choisi" : "Choisir"}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AlbumLookup({
  title,
  artist,
  selected,
  onSelect,
  disabled,
  automatic = true,
}: {
  title: string;
  artist: string;
  selected: MusicCandidate | null;
  onSelect: (candidate: MusicCandidate | null) => void;
  disabled?: boolean;
  automatic?: boolean;
}) {
  const [candidates, setCandidates] = useState<MusicCandidate[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const requestId = useRef(0);
  const canSuggest = title.trim().length >= 3;

  const search = useCallback(
    async (automatic = false) => {
      if (!canSuggest) {
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
        const result = await musicRequest<{ candidates?: MusicCandidate[] }>(
          "/api/music/search-albums",
          { title, artist },
        );
        if (currentRequest !== requestId.current) return;
        const nextCandidates = result.candidates ?? [];
        setCandidates(nextCandidates);
        setState("idle");
        setMessage(
          nextCandidates.length
            ? "Choisis explicitement l’album Deezer correspondant."
            : "Aucun album Deezer trouvé. Tu peux continuer manuellement.",
        );
      } catch (error) {
        if (currentRequest !== requestId.current) return;
        setState("error");
        setCandidates([]);
        setMessage(
          error instanceof Error ? error.message : "La recherche est indisponible.",
        );
      }
    },
    [artist, canSuggest, title],
  );

  useEffect(() => {
    if (!automatic || !canSuggest) return;
    const timer = window.setTimeout(() => void search(true), 750);
    return () => window.clearTimeout(timer);
  }, [automatic, canSuggest, search]);

  return (
    <section className="music-assist music-assist--autocomplete">
      <div className="music-assist__details-head">
        <div>
          <span className="eyebrow">ASSISTANCE DEEZER · ALBUMS</span>
          <p>
            Vérifie la bonne édition avant de confirmer. Rien n’est sélectionné
            automatiquement.
          </p>
        </div>
        <button
          type="button"
          className="sheet-entry-action"
          disabled={disabled || state === "loading" || !canSuggest}
          onClick={() => void search()}
        >
          {state === "loading" ? "Recherche…" : "Rechercher sur Deezer"}
        </button>
      </div>
      {message ? (
        <p
          className={`music-assist__message${state === "error" ? " is-error" : ""}`}
          role="status"
        >
          {message}
        </p>
      ) : null}
      {candidates.length ? (
        <CandidateList
          compact
          candidates={candidates}
          selectedId={selected?.id}
          onSelect={(candidate) => {
            setCandidates([]);
            setMessage("");
            onSelect(candidate);
          }}
        />
      ) : null}
      {candidates.length ? (
        <button
          type="button"
          className="music-manual"
          onClick={() => {
            setCandidates([]);
            setMessage("");
            onSelect(null);
          }}
        >
          Aucun de ces résultats · renseigner manuellement
        </button>
      ) : null}
    </section>
  );
}

export function DeezerTrackLookup({
  title,
  artist,
  disabled,
  onSelect,
}: {
  title: string;
  artist: string;
  disabled?: boolean;
  onSelect: (candidate: DeezerTrackCandidate) => void;
}) {
  const [candidates, setCandidates] = useState<DeezerTrackCandidate[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const requestId = useRef(0);
  const canSearch = title.trim().length >= 2 && artist.trim().length >= 2;

  const search = useCallback(
    async (automatic = false) => {
      if (!canSearch) {
        if (!automatic) {
          setState("error");
          setMessage("Renseigne le titre et l’artiste avant la recherche.");
        }
        return;
      }

      const currentRequest = ++requestId.current;
      setState("loading");
      setMessage("");
      try {
        const result = await musicRequest<{
          candidates?: DeezerTrackCandidate[];
        }>("/api/music/search-favorite-tracks", { title, artist });
        if (currentRequest !== requestId.current) return;
        const nextCandidates = result.candidates ?? [];
        setCandidates(nextCandidates);
        setState("idle");
        setMessage(
          nextCandidates.length
            ? "Choisis explicitement le morceau correspondant."
            : "Aucun morceau Deezer correspondant n’a été trouvé.",
        );
      } catch (error) {
        if (currentRequest !== requestId.current) return;
        setCandidates([]);
        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "La recherche Deezer est indisponible.",
        );
      }
    },
    [artist, canSearch, title],
  );


  return (
    <div className="favorite-track-search">
      <button
        className="favorite-album-card__outline-button"
        type="button"
        disabled={disabled || state === "loading" || !canSearch}
        onClick={() => void search()}
      >
        {state === "loading" ? "Recherche Deezer…" : "Rechercher sur Deezer"}
      </button>
      {message ? (
        <small
          className={state === "error" ? "is-error" : undefined}
          role="status"
        >
          {message}
        </small>
      ) : null}
      {candidates.map((candidate) => (
        <button
          className="favorite-track-search__result"
          type="button"
          key={candidate.id}
          onClick={() => {
            setCandidates([]);
            setMessage("");
            onSelect(candidate);
          }}
        >
          {candidate.coverUrl ? <img src={candidate.coverUrl} alt="" /> : null}
          <span>
            <b>{candidate.title}</b>
            <small>
              {candidate.artist}
              {candidate.albumTitle ? ` · ${candidate.albumTitle}` : ""}
            </small>
          </span>
          <em>Choisir</em>
        </button>
      ))}
    </div>
  );
}

export function TrackLookup({
  label,
  title,
  artist,
  albumTitle,
  selected,
  onTitleChange,
  onSelect,
  disabled,
}: {
  label: string;
  title: string;
  artist: string;
  albumTitle: string;
  selected: MusicCandidate | null;
  onTitleChange: (value: string) => void;
  onSelect: (candidate: MusicCandidate | null) => void;
  disabled?: boolean;
}) {
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
      const result = await musicRequest<{ candidates?: MusicCandidate[] }>(
        "/api/music/search-tracks",
        { title, artist, albumTitle },
      );
      setCandidates(result.candidates ?? []);
      setState("idle");
      setMessage(
        result.candidates?.length
          ? "Choisis le morceau qui correspond vraiment à ton verdict."
          : "Aucun résultat certain : tu peux garder le titre saisi sans lien.",
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "La recherche est indisponible.",
      );
    }
  }, [albumTitle, artist, title]);

  useEffect(() => {
    if (!title.trim()) return;
    const timer = window.setTimeout(() => void search(), 650);
    return () => window.clearTimeout(timer);
  }, [search, title]);

  return (
    <label className="track-lookup">
      <span>{label}</span>
      <div className="track-lookup__input">
        <input
          disabled={disabled}
          maxLength={160}
          value={title}
          onChange={(event) => {
            onTitleChange(event.target.value);
            onSelect(null);
          }}
          placeholder={
            label === "Best track"
              ? "Ton meilleur morceau"
              : "Le morceau le moins convaincant"
          }
        />
      </div>
      {state === "loading" ? <small>Recherche…</small> : null}
      {message && state !== "loading" ? (
        <small className={state === "error" ? "is-error" : ""}>{message}</small>
      ) : null}
      {candidates.length ? (
        <CandidateList
          candidates={candidates}
          selectedId={selected?.id}
          onSelect={(candidate) => {
            onTitleChange(candidate.title);
            onSelect(candidate);
          }}
        />
      ) : null}
    </label>
  );
}
