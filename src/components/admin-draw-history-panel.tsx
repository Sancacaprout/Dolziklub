"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import styles from "./admin-draw-history.module.css";

type Detail = Record<string, unknown>;
type EventRow = {
  id: string;
  draw_number: number;
  actor_username: string | null;
  actor_display_name: string | null;
  event_type: string;
  detail: Detail;
  created_at: string;
};

const eventLabels: Record<string, string> = {
  draw_created: "Tirage créé",
  draw_published: "Tirage publié",
  draw_locked: "Tirage verrouillé",
  draw_deleted: "Tirage supprimé",
  draw_participants_updated: "Participants modifiés",
  entry_assignment_updated: "Duo modifié",
  album_proposed: "Album proposé",
  album_updated: "Album modifié",
  album_removed: "Album retiré",
  verdict_submitted: "Verdict rendu",
  verdict_updated: "Verdict modifié",
  verdict_reset: "Verdict réinitialisé",
};

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function describeEvent(event: EventRow) {
  const detail = event.detail ?? {};
  const position = typeof detail.position === "number" ? `Ligne ${String(detail.position).padStart(2, "0")} · ` : "";
  const before = detail.before as Detail | undefined;
  const after = detail.after as Detail | undefined;

  if (event.event_type === "entry_assignment_updated") {
    return `${position}${asText(after?.proposed_by) ?? "—"} propose · ${asText(after?.listened_by) ?? "—"} écoute${detail.cleared_album ? " · album et verdict retirés" : ""}.`;
  }
  if (event.event_type === "album_proposed" || event.event_type === "album_updated") {
    return `${position}${[asText(after?.title), asText(after?.artist)].filter(Boolean).join(" — ") || "Album renseigné"}.`;
  }
  if (event.event_type === "album_removed") {
    return `${position}${[asText(before?.title), asText(before?.artist)].filter(Boolean).join(" — ") || "Album retiré"}.`;
  }
  if (event.event_type.startsWith("verdict_")) {
    const rating = typeof detail.rating === "number" ? `${detail.rating} / 5` : "sans note";
    return `${position}${asText(detail.album_title) ?? "Album"} · ${rating}.`;
  }
  if (event.event_type === "draw_created" || event.event_type === "draw_deleted") {
    const names = Array.isArray(detail.participants) ? detail.participants.filter((value): value is string => typeof value === "string") : [];
    return names.length ? `Participants : ${names.join(", ")}.` : "Action sur le tirage enregistrée.";
  }
  return "Action administrative enregistrée.";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function AdminDrawHistoryPanel() {
  const configured = isSupabaseConfigured();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(configured ? "loading" : "unavailable");

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void getSupabaseBrowserClient()
      .from("club_draw_audit_log")
      .select("id, draw_number, actor_username, actor_display_name, event_type, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(250)
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (cancelled) return;
        setEvents(error ? [] : ((data ?? []) as EventRow[]));
        setState(error ? "unavailable" : "ready");
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const draws = useMemo(() => [...new Set(events.map((event) => event.draw_number))].sort((a, b) => b - a), [events]);
  const displayed = filter === "all" ? events : events.filter((event) => event.draw_number === Number(filter));

  return (
    <section className={styles.history} aria-labelledby="admin-history-title">
      <div className={styles.header}>
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2 id="admin-history-title">Historique des tirages</h2>
          <p>Un journal en lecture seule : décisions, changements et validations du club.</p>
        </div>
        <label className={styles.filter}>
          Afficher
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Tous les tirages</option>
            {draws.map((draw) => <option key={draw} value={draw}>Tirage {String(draw).padStart(2, "0")}</option>)}
          </select>
        </label>
      </div>
      <p className={styles.notice}>Chaque ligne est horodatée et protégée : elle ne peut être ni modifiée ni supprimée depuis le site.</p>
      {state === "loading" && <p className={styles.empty}>Chargement du journal…</p>}
      {state === "unavailable" && <p className={styles.empty}>Le journal sera disponible dès que la migration de traçabilité aura été appliquée.</p>}
      {state === "ready" && !displayed.length && <p className={styles.empty}>Aucune action n’a encore été enregistrée.</p>}
      {state === "ready" && displayed.length > 0 && (
        <ol className={styles.list}>
          {displayed.map((event) => (
            <li key={event.id} className={styles.event}>
              <div className={styles.eventMeta}><span>Tirage {String(event.draw_number).padStart(2, "0")}</span><time dateTime={event.created_at}>{formatDate(event.created_at)}</time></div>
              <div className={styles.eventMain}><strong>{eventLabels[event.event_type] ?? "Action enregistrée"}</strong><p>{describeEvent(event)}</p></div>
              <span className={styles.actor}>{event.actor_display_name ?? event.actor_username ?? "Système"}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
