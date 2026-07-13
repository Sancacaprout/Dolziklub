"use client";

import { useState } from "react";
import Link from "next/link";
import { AlbumCard } from "@/components/album-card";
import type { Album } from "@/types/album";

type DrawPhase = "idle" | "spinning" | "reveal";

export function RandomAlbum({ albums }: { albums: Album[] }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * albums.length));
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<DrawPhase>("idle");
  const album = albums[index];
  const selectedAlbum = albums[pendingIndex ?? index];
  const playsOnVinyl = selectedAlbum.releaseYear !== null && selectedAlbum.releaseYear < 2000;

  function drawAlbum() {
    if (phase === "spinning") return;
    const nextIndex = albums.length > 1 ? (index + 1 + Math.floor(Math.random() * (albums.length - 1))) % albums.length : index;
    setPendingIndex(nextIndex);
    setPhase("spinning");
    window.setTimeout(() => {
      setIndex(nextIndex);
      setPendingIndex(null);
      setPhase("reveal");
    }, 1150);
    window.setTimeout(() => setPhase("idle"), 2050);
  }

  const status = phase === "spinning"
    ? playsOnVinyl ? "Le vinyle se pose…" : "Le CD s’insère…"
    : phase === "reveal"
      ? playsOnVinyl ? "Face A trouvée." : "CD chargé."
      : playsOnVinyl ? "Vinyle prêt." : "Lecteur CD prêt.";

  return <div className={`random-box random-box--${phase} random-box--${playsOnVinyl ? "vinyl" : "cd"}`}><p className="eyebrow">LE BAC A DÉCIDÉ</p><div className={`random-machine random-machine--${playsOnVinyl ? "vinyl" : "cd"}`} aria-hidden="true">{playsOnVinyl ? <div className="turntable"><div className="vinyl"><span></span></div><i className="tonearm" /></div> : <div className="cd-player"><div className="cd-slot"><div className="cd-disc"><span></span></div></div><small>INSERTING…</small></div>}</div><p className="random-status" aria-live="polite">{status}</p><div className={`random-card-wrap${phase === "spinning" ? " random-card-wrap--hidden" : ""}`}>{phase === "spinning" ? <div className="random-card-placeholder"><span>Album sélectionné</span></div> : <AlbumCard album={album} compact />}</div><div className="random-actions"><button className="button" onClick={drawAlbum} disabled={phase === "spinning"}>{phase === "spinning" ? "Le bac tourne…" : "Tirer un album"}</button>{phase !== "spinning" && <Link className="text-link" href={`/albums/${album.slug}`}>Voir la fiche →</Link>}</div></div>;
}
