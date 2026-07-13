"use client";

import { useState } from "react";
import Link from "next/link";
import { AlbumCard } from "@/components/album-card";
import type { Album } from "@/types/album";

type DrawPhase = "idle" | "spinning" | "reveal";

export function RandomAlbum({ albums }: { albums: Album[] }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * albums.length));
  const [phase, setPhase] = useState<DrawPhase>("idle");
  const album = albums[index];
  const playsOnVinyl = album.releaseYear !== null && album.releaseYear < 2000;
  function drawAlbum() {
    if (phase === "spinning") return;

    const nextIndex = phase === "reveal" && albums.length > 1
      ? (index + 1 + Math.floor(Math.random() * (albums.length - 1))) % albums.length
      : index;
    const nextAlbum = albums[nextIndex];
    const nextPlaysOnVinyl = nextAlbum.releaseYear !== null && nextAlbum.releaseYear < 2000;
    if (nextIndex !== index) setIndex(nextIndex);

    setPhase("spinning");
    window.setTimeout(() => setPhase("reveal"), nextPlaysOnVinyl ? 2450 : 1150);
  }

  const status = phase === "spinning"
    ? playsOnVinyl ? "Le vinyle se pose sur le plateau…" : "Le CD s’insère…"
    : phase === "reveal"
      ? playsOnVinyl ? "Face A trouvée." : "CD chargé."
      : playsOnVinyl ? "Vinyle prêt à être posé." : "CD prêt à être inséré.";

  return <div className={`random-box random-box--${phase} random-box--${playsOnVinyl ? "vinyl" : "cd"}`}><p className="eyebrow">LE BAC A DÉCIDÉ</p><div className={`random-machine random-machine--${playsOnVinyl ? "vinyl" : "cd"}`} aria-hidden="true">{playsOnVinyl ? <div className="turntable"><div className="platter"><div className="vinyl-loader"><div className="vinyl"><span></span></div></div></div><i className="tonearm" /></div> : <div className="cd-player"><div className="cd-slot"><div className="cd-disc"><span></span></div></div><small>INSERTING…</small></div>}</div><p className="random-status" aria-live="polite">{status}</p>{phase === "reveal" && <div className="random-card-wrap"><AlbumCard album={album} compact /></div>}<div className="random-actions"><button className="button" onClick={drawAlbum} disabled={phase === "spinning"}>{phase === "spinning" ? "Le bac tourne…" : phase === "reveal" ? "Tirer un autre album" : "Tirer un album"}</button>{phase === "reveal" && <Link className="text-link" href={`/albums/${album.slug}`}>Voir la fiche →</Link>}</div></div>;
}
