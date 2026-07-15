"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

type AuditDetail = Record<string, unknown>;
type AuditEvent = {
  id: string;
  draw_number: number;
  entry_id: string | null;
  actor_username: string | null;
  actor_display_name: string | null;
  event_type: string;
  detail: AuditDetail;
  created_at: string;
};

const labels: Record<string, string> = {
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

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function entryLabel(detail: AuditDetail) {
  const position = typeof detail.position === "number" ? detail.position : null;
  return position ? `Ligne ${String(position).padStart(2, "0")}` : null;
}

function detailText(event: AuditEvent) {
  const detail = event.detail ?? {};
  const after = detail.after as AuditDetail | undefined;
  const before = detail.before as AuditDetail | undefined;
  const line = entryLabel(detail);
  const albumAfter = after ? [text(after.title), text(after.artist)].filter(Boolean).join(" — ") : "";
  const albumBefore = before ? [text(before.title), text(before.artist)].filter(Boolean).join(" — ") : "";
  const albumTitle = text(detail.album_title);
  const newProposer = after ? text(after.proposed_by) : null;
  const newListener = after ? text(after.listened_by) : null;

  if (event.event_type === "entry_assignment_updated") {
    return `${line ? `${line} · ` : ""}${newProposer ?? "—"} propose, ${newListener ?? "—"} écoute.${detail.cleared_album ? " L’album et le verdict associés ont été retirés." : ""}`;
  }
  if (event.event_type === "album_proposed" || event.event_type === "album_updated") {
    return `${line ? `${line} · ` : ""}${albumAfter || "Album renseigné"}`;
  }
  if (event.event_type === "album_removed") {
    return `${line ? `${line} · ` : ""}${albumBefore || "Album retiré"}`;
  }
  if (event.event_type.startsWith("verdict_")) {
    const rating = typeof detail.rating === "number" ? `${detail.rating} / 5` : "sans note";
    return `${line ? `${line} · ` : ""}${albumTitle ?? "Album"} · ${rating}`;
  }
  if (event.event_type === "draw_created" || event.event_type === "draw_deleted") {
    const participants = Array.isArray(detail.participants)
      ? detail.participants.filter((name): name is string => typeof name === "string").join(", ")
      : "";
    return participants ? `Participants : ${participants}` : "";
  }
  return "Événement administratif enregistré.";
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function AdminDrawHistory() {
  const configured = isSupabaseConfigured();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");
  const [draw, setDraw] = useState("all");

  useEffect(() => {
    if (!configured) {
      return;
    }
    let cancelled = false;
    void getSupabaseBrowserClient()
      .from("club_draw_audit_log")
      .select("id, draw_number, entry_id, actor_username, actor_display_name, event_type, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(250)
      .then((result: { data: unknown; error: unknown }) => {
        if (cancelled) return;
        if (result.error) {
          setError("Le journal n’est pas encore disponible. Vérifie que la migration de traçabilité a été appliquée.");
          setEvents([]);
        } else {
          setEvents((result.data ?? []) as AuditEvent[]);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const draws = useMemo(
    () => [...new Set(events.map((event) => event.draw_number))].sort((a, b) => b - a),
    [events],
  );
  const displayed = draw === "all" ? events : events.filter((event) => event.draw_number === Number(draw));

  return (
    <section className="admin-history" aria-labelledby="admin-history-title">
      <div className="admin-history__header">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2 id="admin-history-title">Historique des tirages</h2>
          <p>Journal en lecture seule des décisions et modifications du club.</p>
        </div>
        <label className="admin-history__filter">
          Afficher
          <select value={draw} onChange={(event) => setDraw(event.target.value)}>
            <option value="all">Tous les tirages</option>
            {draws.map((number) => (
              <option key={number} value={number}>
                Tirage {String(number).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="admin-history__notice">
        Chaque ligne est horodatée et ne peut être ni modifiée ni supprimée depuis le site.
      </p>

      {loading ? (
        <p className="admin-history__empty">Chargement du journal…</p>
      ) : error ? (
        <p className="admin-history__empty">{error}</p>
      ) : displayed.length ? (
        <ol className="admin-history__list">
          {displayed.map((event) => (
            <li key={event.id} className="admin-history__event">
              <div className="admin-history__event-meta">
                <span>Tirage {String(event.draw_number).padStart(2, "0")}</span>
                <time dateTime={event.created_at}>{dateLabel(event.created_at)}</time>
              </div>
              <div className="admin-history__event-main">
                <strong>{labels[event.event_type] ?? "Action enregistrée"}</strong>
                <p>{detailText(event)}</p>
              </div>
              <span className="admin-history__actor">
                {event.actor_display_name ?? event.actor_username ?? "Système"}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="admin-history__empty">Aucune action n’a encore été enregistrée.</p>
      )}
    </section>
  );
}
