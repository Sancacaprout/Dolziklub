"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProposalAssistantCard, ReviewAssistantCard, type AssistedProposalPayload, type AssistedReviewPayload } from "@/components/music-selection-cards";
import { MusicTrackChoiceButton } from "@/components/music-player";
import { RatingDisplay } from "@/components/rating-display";
import { ReviewPreview } from "@/components/review-preview";
import { members } from "@/data/members";
import {
  EXTRA_LISTENING_PUBLIC_COLUMNS,
  extraListeningStatusLabels,
  isExtraListeningActive,
  isSameMember,
  type ExtraListeningRequest,
} from "@/lib/extra-listenings";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { youtubeMusicSearchUrl } from "@/lib/youtube-music";
import collapseStyles from "./collapsible-workspace.module.css";
import styles from "./extra-listenings.module.css";

type DrawOption = {
  draw_number: number;
  participant_usernames: string[];
  status: "draft" | "published" | "locked";
};

type SignedMember = {
  id: string;
  username: string;
  displayName: string;
};

function formatDraw(drawNumber: number) {
  return String(drawNumber).padStart(2, "0");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function publicCoverUrl(request: ExtraListeningRequest) {
  if (request.cover_path && isSupabaseConfigured()) {
    return getSupabaseBrowserClient().storage
      .from("album-covers")
      .getPublicUrl(request.cover_path).data.publicUrl;
  }
  return request.cover_source_url;
}

function memberHref(username: string) {
  const member = members.find((candidate) =>
    [candidate.username, candidate.slug, candidate.displayName].some(
      (value) => value?.trim().toLocaleLowerCase() === username.trim().toLocaleLowerCase(),
    ),
  );
  return member ? `/membres/${member.slug}` : null;
}

function MemberLink({ username, displayName }: { username: string; displayName: string }) {
  const href = memberHref(username);
  return href ? <Link href={href}>{displayName}</Link> : <span>{displayName}</span>;
}

function StatusBadge({ status }: { status: ExtraListeningRequest["status"] }) {
  return (
    <span className={styles.status} data-status={status}>
      {extraListeningStatusLabels[status]}
    </span>
  );
}

export function ExtraListeningTable({
  drawNumber,
  requests,
  member,
  isAdmin,
  onOpen,
  onDelete,
}: {
  drawNumber: number;
  requests: ExtraListeningRequest[];
  member: SignedMember | null;
  isAdmin: boolean;
  onOpen: (requestId: string, mode: "propose" | "listen" | "view") => void;
  onDelete: (requestId: string) => void;
}) {
  const rows = requests
    .filter((request) => request.draw_number === drawNumber)
    .sort((first, second) => second.requested_at.localeCompare(first.requested_at));

  return (
    <section className={styles.attachedTable} aria-labelledby={`extra-listenings-title-${drawNumber}`}>
      <div className={styles.attachedHeading}>
        <div>
          <span className={styles.outsideLabel}>HORS TIRAGE CLASSIQUE</span>
          <h3 id={`extra-listenings-title-${drawNumber}`}>
            Écoutes supplémentaires du tirage {formatDraw(drawNumber)}
          </h3>
        </div>
        <span>{rows.length} demande{rows.length > 1 ? "s" : ""}</span>
      </div>
      {rows.length ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Demandeur</th>
                <th>Proposé par</th>
                <th>Album · Artiste</th>
                <th>Avis</th>
                <th>Note</th>
                <th>Best track</th>
                <th>Worst track</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => {
                const requester = member && isSameMember(request.requester_username, member.username);
                const proposer = member && isSameMember(request.proposer_username, member.username);
                const mode = proposer && request.status === "pending_proposal"
                  ? "propose"
                  : requester && (request.status === "album_proposed" || request.status === "listening")
                    ? "listen"
                    : "view";
                const actionLabel = mode === "propose" ? "Proposer" : mode === "listen" ? "Écouter / noter" : "Voir";
                const albumUrl = request.youtube_music_url
                  ?? request.deezer_url
                  ?? (request.album_title ? youtubeMusicSearchUrl(request.album_title, request.album_artist) : null);
                const hasParticipantAction = Boolean(member && (requester || proposer));
                return (
                  <tr key={request.id}>
                    <td><MemberLink username={request.requester_username} displayName={request.requester_display_name} /></td>
                    <td><MemberLink username={request.proposer_username} displayName={request.proposer_display_name} /></td>
                    <td>
                      <div className={styles.albumCell}>
                        {publicCoverUrl(request) ? (
                          <Image unoptimized src={publicCoverUrl(request)!} alt="" width={44} height={44} />
                        ) : null}
                        <span className={styles.albumIdentity}>
                          {request.album_title && albumUrl ? (
                            <a href={albumUrl} target="_blank" rel="noreferrer">{request.album_title}</a>
                          ) : (
                            <strong>{request.album_title ?? "En attente"}</strong>
                          )}
                          <small>{request.album_artist ?? "—"}</small>
                        </span>
                      </div>
                    </td>
                    <td className={styles.reviewCell}><ReviewPreview title={request.review_title} review={request.review} /></td>
                    <td>{request.rating == null ? "—" : <RatingDisplay rating={request.rating} />}</td>
                    <td>
                      {request.best_track ? (
                        <MusicTrackChoiceButton
                          className={styles.trackLink}
                          title={request.best_track}
                          artist={request.album_artist ?? ""}
                          albumTitle={request.album_title ?? undefined}
                          youtubeMusicUrl={youtubeMusicSearchUrl(request.best_track, request.album_artist, request.album_title)}
                        >
                          {request.best_track}<span aria-hidden="true">↗</span>
                        </MusicTrackChoiceButton>
                      ) : "—"}
                    </td>
                    <td>
                      {request.worst_track ? (
                        <MusicTrackChoiceButton
                          className={styles.trackLink}
                          title={request.worst_track}
                          artist={request.album_artist ?? ""}
                          albumTitle={request.album_title ?? undefined}
                          youtubeMusicUrl={youtubeMusicSearchUrl(request.worst_track, request.album_artist, request.album_title)}
                        >
                          {request.worst_track}<span aria-hidden="true">↗</span>
                        </MusicTrackChoiceButton>
                      ) : "—"}
                    </td>
                    <td>
                      {hasParticipantAction || isAdmin ? (
                        <div className={styles.tableActions}>
                          {hasParticipantAction ? (
                            <button type="button" className={styles.tableAction} onClick={() => onOpen(request.id, mode)}>
                              {actionLabel}
                            </button>
                          ) : null}
                          {isAdmin ? (
                            <button
                              type="button"
                              className={styles.deleteAction}
                              aria-label={`Supprimer l’écoute supplémentaire ${request.album_title ?? "en attente"}`}
                              onClick={() => onDelete(request.id)}
                            >
                              Supprimer
                            </button>
                          ) : null}
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.emptyAttached}>Aucune écoute supplémentaire pour ce tirage.</p>
      )}
    </section>
  );
}

export function ExtraListeningWorkspace({
  draws,
  member,
  focusedRequestId,
  onChanged,
}: {
  draws: DrawOption[];
  member: SignedMember;
  focusedRequestId: string | null;
  onChanged?: () => void;
}) {
  const configured = isSupabaseConfigured();
  const consumedFocus = useRef<string | null>(null);
  const [requests, setRequests] = useState<ExtraListeningRequest[]>([]);
  const [proposerUsername, setProposerUsername] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const currentDraw = useMemo(
    () => draws
      .filter((draw) => draw.status === "published")
      .sort((first, second) => second.draw_number - first.draw_number)[0] ?? null,
    [draws],
  );
  const selectedDraw = currentDraw?.participant_usernames.some((username) => isSameMember(username, member.username))
    ? currentDraw
    : null;
  const selectedDrawNumber = selectedDraw?.draw_number ?? null;
  const proposerOptions = members.filter((candidate) =>
    candidate.username
    && selectedDraw?.participant_usernames.some((username) => isSameMember(username, candidate.username))
    && !isSameMember(candidate.username, member.username),
  );

  const loadRequests = useCallback(async () => {
    if (!configured) return;
    const { data, error } = await getSupabaseBrowserClient()
      .from("extra_listening_requests")
      .select(`${EXTRA_LISTENING_PUBLIC_COLUMNS}, message`)
      .order("requested_at", { ascending: false });
    if (error) {
      setNotice("Les écoutes supplémentaires n’ont pas pu être chargées.");
      return;
    }
    setRequests((data ?? []) as ExtraListeningRequest[]);
  }, [configured]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRequests(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  useEffect(() => {
    if (!focusedRequestId || consumedFocus.current === focusedRequestId || !requests.some((request) => request.id === focusedRequestId)) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`extra-request-${focusedRequestId}`);
      if (!target) return;
      consumedFocus.current = focusedRequestId;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedRequestId, requests]);

  const refresh = async () => {
    await loadRequests();
    onChanged?.();
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured || !selectedDrawNumber || !proposerUsername) return;
    setSavingId("request");
    setNotice("");
    const { error } = await getSupabaseBrowserClient().rpc("create_extra_listening_request", {
      p_draw_number: selectedDrawNumber,
      p_proposer_username: proposerUsername,
      p_message: requestMessage.trim() || null,
    });
    setSavingId(null);
    if (error) {
      setNotice(error.message);
      return;
    }
    setProposerUsername("");
    setRequestMessage("");
    setNotice("Demande envoyée : le membre choisi vient d’être prévenu.");
    await refresh();
  };

  const saveProposal = async (payload: AssistedProposalPayload) => {
    if (!configured) return;
    setSavingId(payload.entryId);
    setNotice("");
    let coverPath: string | null = null;
    try {
      if (payload.file) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(payload.file.type) || payload.file.size > 5 * 1024 * 1024) {
          throw new Error("Choisis une image JPG, PNG ou WebP de 5 Mo maximum.");
        }
        const extension = payload.file.name.split(".").pop()?.toLocaleLowerCase() || "jpg";
        coverPath = `${member.id}/extra/${payload.entryId}.${extension}`;
        const { error } = await getSupabaseBrowserClient().storage
          .from("album-covers")
          .upload(coverPath, payload.file, {
            upsert: true,
            contentType: payload.file.type,
            cacheControl: "31536000",
          });
        if (error) throw error;
      }

      const { error } = await getSupabaseBrowserClient().rpc("propose_extra_listening_album", {
        p_request_id: payload.entryId,
        p_album_title: payload.title.trim(),
        p_album_artist: payload.artist.trim(),
        p_cover_path: coverPath,
        p_cover_source_url: payload.match?.thumbnailUrl ?? null,
        p_deezer_url: payload.match?.source === "deezer_search" ? payload.match.externalUrl ?? null : null,
        p_youtube_music_url: payload.match?.youtubeMusicUrl ?? null,
      });
      if (error) throw error;
      setNotice("Album proposé : le demandeur vient d’être prévenu.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "L’album n’a pas pu être proposé.");
    } finally {
      setSavingId(null);
    }
  };

  const clearProposal = async (requestId: string) => {
    setSavingId(requestId);
    const { error } = await getSupabaseBrowserClient().rpc("clear_extra_listening_album", {
      p_request_id: requestId,
    });
    setSavingId(null);
    if (error) setNotice(error.message);
    else {
      setNotice("La proposition a été retirée. La demande repasse en attente.");
      await refresh();
    }
  };

  const cancelRequest = async (request: ExtraListeningRequest) => {
    const prompt = request.status === "pending_proposal"
      ? "Annuler cette demande ?"
      : "Annuler cette écoute supplémentaire ? La proposition restera conservée dans l’historique.";
    if (!window.confirm(prompt)) return;
    setSavingId(request.id);
    const { error } = await getSupabaseBrowserClient().rpc("cancel_extra_listening_request", {
      p_request_id: request.id,
    });
    setSavingId(null);
    if (error) setNotice(error.message);
    else {
      setNotice("Demande annulée.");
      await refresh();
    }
  };

  const startListening = async (request: ExtraListeningRequest) => {
    const albumUrl = request.deezer_url ?? request.youtube_music_url;
    if (albumUrl) window.open(albumUrl, "_blank", "noopener,noreferrer");
    if (request.status === "album_proposed") {
      const { error } = await getSupabaseBrowserClient().rpc("start_my_extra_listening", {
        p_request_id: request.id,
      });
      if (error) setNotice(error.message);
      else await refresh();
    }
  };

  const saveReview = async (payload: AssistedReviewPayload) => {
    setSavingId(payload.entryId);
    const { error } = await getSupabaseBrowserClient().rpc("save_my_extra_listening_review", {
      p_request_id: payload.entryId,
      p_review_title: payload.reviewTitle?.trim() || null,
      p_review: payload.review.trim(),
      p_rating: payload.rating,
      p_best_track: payload.bestTrack.trim() || null,
      p_worst_track: payload.worstTrack.trim() || null,
    });
    setSavingId(null);
    if (error) setNotice(error.message);
    else {
      setNotice("Verdict enregistré. Cette écoute est maintenant verrouillée.");
      await refresh();
    }
  };

  const assignedRequests = requests.filter((request) =>
    isSameMember(request.proposer_username, member.username)
    && isExtraListeningActive(request.status),
  );
  const ownRequests = requests.filter((request) => isSameMember(request.requester_username, member.username));

  return (
    <section id="extra-listening-workspace" className={styles.workspace} tabIndex={-1}>
      <header className={`${styles.workspaceHeader}${collapsed ? ` ${collapseStyles.compactHeader}` : ""}`}>
        <div className={collapseStyles.headingRow}>
          <div>
            <p className="eyebrow">ÉCOUTE SUPPLÉMENTAIRE SUR DEMANDE</p>
            <h2>Ma prochaine écoute <em>choisie par un membre.</em></h2>
            {!collapsed ? <p>Choisis un membre du tirage actuel : il pourra te proposer un album spécialement pour cette écoute, sans modifier le tirage classique.</p> : null}
          </div>
          <button
            type="button"
            className={collapseStyles.collapseButton}
            aria-expanded={!collapsed}
            aria-controls="extra-listening-workspace-content"
            onClick={() => setCollapsed((current) => !current)}
          >
            {collapsed ? "Déplier" : "Réduire"}
          </button>
        </div>
      </header>

      <div
        id="extra-listening-workspace-content"
        className={collapseStyles.content}
        hidden={collapsed}
      >
      {notice ? <p className={styles.notice} role="status" aria-live="polite">{notice}</p> : null}

      <form className={styles.requestForm} onSubmit={submitRequest}>
        <div className={styles.currentDrawField}>
          <span>Tirage concerné</span>
          <strong>{selectedDrawNumber ? <>Tirage {formatDraw(selectedDrawNumber)}</> : "Aucun tirage actuel disponible"}</strong>
          <small>Les écoutes supplémentaires concernent uniquement le tirage actuellement publié.</small>
        </div>
        <label>
          <span>Membre qui proposera l’album</span>
          <select value={proposerUsername} onChange={(event) => setProposerUsername(event.target.value)} disabled={!selectedDrawNumber} required>
            <option value="">Choisir un membre</option>
            {proposerOptions.map((candidate) => (
              <option key={candidate.username!} value={candidate.username!}>{candidate.displayName}</option>
            ))}
          </select>
        </label>
        <label className={styles.messageField}>
          <span>Petit message (facultatif)</span>
          <textarea maxLength={360} value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} placeholder="Une envie, une humeur, un défi musical…" />
        </label>
        <button type="submit" className="button" disabled={!selectedDrawNumber || !proposerUsername || savingId === "request"}>
          {savingId === "request" ? "Envoi…" : "Envoyer ma demande"}
        </button>
      </form>

      <section className={styles.queueSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">DEMANDES D’ALBUMS EN ATTENTE</p>
            <h3>Albums supplémentaires à proposer</h3>
          </div>
          <span>{assignedRequests.length}</span>
        </div>
        <div className={styles.queue}>
          {assignedRequests.length ? assignedRequests.map((request) => (
            <article id={`extra-request-${request.id}`} className={styles.taskCard} key={`${request.id}:${request.updated_at}`} tabIndex={-1}>
              <div className={styles.taskMeta}>
                <p><strong>{request.requester_display_name}</strong> te demande un album supplémentaire pour le tirage {formatDraw(request.draw_number)}.</p>
                <small>Demandé le {formatDate(request.requested_at)} · Cette proposition reste séparée du tirage classique.</small>
                {request.message ? <blockquote>« {request.message} »</blockquote> : null}
                <StatusBadge status={request.status} />
              </div>
              <ProposalAssistantCard
                entry={{
                  id: request.id,
                  album_title: request.album_title,
                  album_artist: request.album_artist,
                  cover_path: request.cover_path,
                  cover_source_url: request.cover_source_url,
                  youtube_music_url: request.youtube_music_url,
                }}
                coverUrl={publicCoverUrl(request)}
                saving={savingId === request.id}
                onSave={(payload) => void saveProposal(payload)}
                onDelete={(requestId) => void clearProposal(requestId)}
                submitLabel="Proposer cet album"
              />
            </article>
          )) : <p className={styles.empty}>Aucune demande d’album ne t’attend.</p>}
        </div>
      </section>

      <section className={styles.queueSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">MES ÉCOUTES SUPPLÉMENTAIRES</p>
            <h3>Mes demandes et mes verdicts</h3>
          </div>
          <span>{ownRequests.length}</span>
        </div>
        <div className={styles.queue}>
          {ownRequests.length ? ownRequests.map((request) => (
            <article id={`extra-request-${request.id}`} className={styles.taskCard} key={`mine:${request.id}:${request.updated_at}`} tabIndex={-1}>
              <div className={styles.taskMeta}>
                <p>Tirage {formatDraw(request.draw_number)} · demandé à <strong>{request.proposer_display_name}</strong></p>
                <StatusBadge status={request.status} />
                {request.status !== "reviewed" && request.status !== "cancelled" ? (
                  <button type="button" className={styles.cancelButton} disabled={savingId === request.id} onClick={() => void cancelRequest(request)}>
                    Annuler la demande
                  </button>
                ) : null}
              </div>

              {request.status === "pending_proposal" ? (
                <p className={styles.waiting}>Ton membre a reçu la demande. Aucun album vide n’a été ajouté au tableau principal.</p>
              ) : null}

              {request.status === "album_proposed" || request.status === "listening" ? (
                <>
                  <div className={styles.listenActions}>
                    {request.deezer_url || request.youtube_music_url ? (
                      <button type="button" className={styles.listenButton} onClick={() => void startListening(request)}>
                        Écouter l’album ↗
                      </button>
                    ) : null}
                    <span>{request.album_title} — {request.album_artist}</span>
                  </div>
                  <ReviewAssistantCard
                    entry={{
                      id: request.id,
                      album_title: request.album_title,
                      album_artist: request.album_artist,
                      cover_path: request.cover_path,
                      cover_source_url: request.cover_source_url,
                      youtube_music_url: request.youtube_music_url,
                    }}
                    coverUrl={publicCoverUrl(request)}
                    saving={savingId === request.id}
                    onSave={(payload) => void saveReview(payload)}
                    onReset={() => undefined}
                  />
                </>
              ) : null}

              {request.status === "reviewed" ? (
                <div className={styles.finished}>
                  <div>
                    <strong>{request.album_title}</strong>
                    <span>{request.album_artist}</span>
                  </div>
                  {request.rating == null ? null : <RatingDisplay rating={request.rating} />}
                  <ReviewPreview title={request.review_title} review={request.review} />
                </div>
              ) : null}

              {request.status === "cancelled" ? <p className={styles.waiting}>Demande annulée et conservée dans l’historique.</p> : null}
            </article>
          )) : <p className={styles.empty}>Tu n’as encore demandé aucune écoute supplémentaire.</p>}
        </div>
      </section>
      </div>
    </section>
  );
}
