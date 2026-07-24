"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";

export type WheelMember = { username: string; displayName: string };

export function GlobalDrawWheel({ participants, winnerUsername, drawNumber, onComplete, mode }: { participants: WheelMember[]; winnerUsername: string; drawNumber?: number; onComplete: () => void; mode: "creation" | "reveal" }) {
  const winnerIndex = Math.max(0, participants.findIndex((participant) => participant.username.toLowerCase() === winnerUsername.toLowerCase()));
  const winner = participants[winnerIndex] ?? { username: winnerUsername, displayName: winnerUsername };
  const [rotation, setRotation] = useState(0);
  const [finished, setFinished] = useState(false);
  const segment = 360 / Math.max(participants.length, 1);
  const targetRotation = useMemo(() => 360 * 7 + 360 - winnerIndex * segment, [segment, winnerIndex]);

  useEffect(() => {
    const start = window.setTimeout(() => setRotation(targetRotation), 80);
    const finish = window.setTimeout(() => setFinished(true), 4700);
    return () => { window.clearTimeout(start); window.clearTimeout(finish); };
  }, [targetRotation]);

  return <div className="global-wheel-overlay" role="dialog" aria-modal="true" aria-labelledby="global-wheel-title">
    <section className="global-wheel-dialog">
      <p className="eyebrow">{mode === "creation" ? "TIRAGE GLOBAL" : `TIRAGE ${String(drawNumber ?? 0).padStart(2, "0")} \u00b7 \u00c9COUTE GLOBALE`}</p>
      <h2 id="global-wheel-title">{finished ? "Le choix du club est fait." : "La roue du club tourne..."}</h2>
      <p>{finished ? <><b>{winner.displayName}</b> choisit l&apos;album que tout le monde va \u00e9couter.</> : "Un seul membre va proposer l'album commun."}</p>
      <div className="global-wheel-stage" aria-label={`La roue choisit ${winner.displayName}`}>
        <span className="global-wheel-pointer" aria-hidden="true" />
        <div className="global-wheel" style={{ "--wheel-rotation": `${rotation}deg`, "--wheel-segments": participants.length } as CSSProperties}>
          {participants.map((participant, index) => <span className="global-wheel__name" style={{ "--wheel-angle": `${index * segment}deg` } as CSSProperties} key={participant.username}>{participant.displayName}</span>)}
          <span className="global-wheel__hub">DZ</span>
        </div>
      </div>
      <div className="global-wheel-result" aria-live="polite">{finished ? <><span>\u00c9LU.E</span><strong>{winner.displayName}</strong></> : <span>La d\u00e9cision arrive...</span>}</div>
      {finished && <button className="button global-wheel__continue" type="button" onClick={onComplete}>{mode === "creation" ? "Cr\u00e9er le tirage global" : "Voir le tirage"} <span aria-hidden="true">\u2192</span></button>}
    </section>
  </div>;
}
