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

  function drawAlbum() {
    if (phase === "spinning") return;
    const nextIndex = albums.length > 1 ? (index + 1 + Math.floor(Math.random() * (albums.length - 1))) % albums.length : index;
    setPhase("spinning");
    window.setTimeout(() => {
      setIndex(nextIndex);
      setPhase("reveal");
    }, 1050);
    window.setTimeout(() => setPhase("idle"), 1900);
  }

  return <div className={`random-box random-box--${phase}`}><p className="eyebrow">LE BAC A DÉCIDÉ</p><div className="random-machine" aria-hidden="true"><div className="turntable"><div className="vinyl"><span></span></div><i className="tonearm" /></div><div className="cd-player"><div className="cd-slot"><div className="cd-disc"><span></span></div></div><small>SELECTING…</small></div></div><p className="random-status" aria-live="polite">{phase === "spinning" ? "Le disque tourne…" : phase === "reveal" ? "Disque trouvé." : "Prêt à tirer."}</p><div className="random-card-wrap"><AlbumCard album={album} compact /></div><div className="random-actions"><button className="button" onClick={drawAlbum} disabled={phase === "spinning"}>{phase === "spinning" ? "Le bac tourne…" : "Lancer le disque"}</button><Link className="text-link" href={`/albums/${album.slug}`}>Voir la fiche →</Link></div></div>;
}
