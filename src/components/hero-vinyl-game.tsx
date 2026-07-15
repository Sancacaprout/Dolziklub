"use client";

import { useEffect, useRef, useState } from "react";

const BEAT_MS = 720;
const HIT_WINDOW_MS = 150;
const ROUNDS = 5;

function resultLine(score: number) {
  if (score === ROUNDS) return "Oreille d’or certifiée. Le sillon t’a reconnu.";
  if (score >= 3) return "Pas mal. Tu peux retourner le disque sans le rayer.";
  if (score >= 1) return "Le groove existe, mais il s’est caché dans la face B.";
  return "Le vinyle a gagné. Il demande un verre d’eau et un rappel.";
}

export function HeroVinylGame() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "playing" | "result">("idle");
  const [hits, setHits] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("Le voyant jaune donne le tempo.");
  const startedAt = useRef(0);
  const lastRound = useRef(-1);

  const reset = () => {
    setStatus("idle");
    setHits(0);
    setScore(0);
    setFeedback("Le voyant jaune donne le tempo.");
    lastRound.current = -1;
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const start = () => {
    startedAt.current = Date.now();
    lastRound.current = -1;
    setHits(0);
    setScore(0);
    setFeedback("Top. Clique pile quand le voyant pulse.");
    setStatus("playing");
  };

  const tap = () => {
    if (status !== "playing") return;
    const elapsed = Date.now() - startedAt.current;
    const round = Math.floor(elapsed / BEAT_MS);
    if (round === lastRound.current) return;
    lastRound.current = round;

    const phase = elapsed % BEAT_MS;
    const distance = Math.min(phase, BEAT_MS - phase);
    const perfect = distance <= HIT_WINDOW_MS;
    const nextHits = hits + 1;
    const nextScore = score + (perfect ? 1 : 0);
    setHits(nextHits);
    setScore(nextScore);
    setFeedback(perfect ? "DANS LE TEMPO !" : "Un peu à côté du sillon…");

    if (nextHits === ROUNDS) {
      setStatus("result");
      setFeedback(resultLine(nextScore));
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.code === "Space" && status === "playing") {
        event.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return <>
    <button className="hero-vinyl-button" type="button" onClick={() => { reset(); setOpen(true); }} aria-label="Ouvrir le mini-jeu du vinyle">
      <span className="hero-vinyl-button__disc" aria-hidden="true" />
      <span className="hero-vinyl-button__hint">PLAY</span>
    </button>
    {open ? <div className="vinyl-game" role="dialog" aria-modal="true" aria-labelledby="vinyl-game-title">
      <div className="vinyl-game__backdrop" onClick={close} aria-hidden="true" />
      <section className="vinyl-game__panel">
        <button className="vinyl-game__close" type="button" onClick={close} aria-label="Fermer le mini-jeu">×</button>
        <p className="eyebrow">EASTER EGG · FACE B</p>
        <h2 id="vinyl-game-title">Attrape le<br /><em>groove.</em></h2>
        <p className="vinyl-game__intro">Cinq battements, cinq clics. Appuie sur le disque — ou sur espace — quand le voyant jaune pulse.</p>
        {status === "idle" ? <button className="button vinyl-game__start" type="button" onClick={start}>Lancer le disque →</button> : <>
          <button className={`vinyl-game__disc ${status === "playing" ? "is-playing" : ""}`} type="button" onClick={tap} aria-label="Cliquer en rythme sur le vinyle">
            <span className="vinyl-game__needle" aria-hidden="true" />
            <span className="vinyl-game__label">{status === "result" ? `${score} / ${ROUNDS}` : `${hits} / ${ROUNDS}`}</span>
          </button>
          <p className={`vinyl-game__feedback ${status === "result" ? "is-result" : ""}`} aria-live="polite">{feedback}</p>
          {status === "result" ? <button className="button vinyl-game__start" type="button" onClick={start}>Rejouer la face B →</button> : null}
        </>}
      </section>
    </div> : null}
  </>;
}