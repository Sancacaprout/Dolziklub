"use client";

import { useEffect, useState } from "react";
import styles from "./draw-countdown.module.css";

export const DRAW_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function countdownParts(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function parisDeadline(deadline: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(deadline);
}

export function DrawCountdown({ createdAt }: { createdAt: string }) {
  const createdAtMs = Date.parse(createdAt);
  const deadlineMs = createdAtMs + DRAW_DURATION_MS;
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNowMs(Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!Number.isFinite(deadlineMs)) return null;

  const deadline = new Date(deadlineMs);
  const remainingMs = nowMs == null ? null : Math.max(0, deadlineMs - nowMs);
  const remaining = countdownParts(remainingMs ?? 0);
  const finished = remainingMs === 0;
  const display = remainingMs == null
    ? "-- J  --:--:--"
    : `${twoDigits(remaining.days)} J  ${twoDigits(remaining.hours)}:${twoDigits(remaining.minutes)}:${twoDigits(remaining.seconds)}`;

  return (
    <div className={styles.timer} data-finished={finished || undefined}>
      <span className={styles.label}>TEMPS RESTANT · 7 JOURS</span>
      <strong className={styles.value} role="timer" aria-label={finished ? "Délai terminé" : display}>
        {display}
      </strong>
      <time className={styles.deadline} dateTime={deadline.toISOString()}>
        Échéance : {parisDeadline(deadline)} · heure de Paris
      </time>
      {finished ? <small className={styles.finished}>Délai indicatif terminé</small> : null}
    </div>
  );
}
