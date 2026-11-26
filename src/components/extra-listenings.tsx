"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { DisclosureButton, DisclosureContent, useStoredDisclosure } from "./persistent-disclosure";
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

function ExtraRequestCard({ request, memberId, focused, action, summary, children }: {
  request: ExtraListeningRequest;
  memberId: string;
  focused: boolean;
  action?: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const { open, setOpen } = useStoredDisclosure(`extra-request:${request.id}`, memberId);
  const contentId = `extra-request-details-${request.id}`;
  useEffect(() => { if (focused) setOpen(true); }, [focused, setOpen]);
  return <article id={`extra-request-${request.id}`} className={styles.taskCard} tabIndex={-1}>
    <div className={collapseStyles.headingRow}>
      <div className={styles.taskMeta}>
        {summary}
        <StatusBadge status={request.status} />
        {!open && action ? <small>{action}</small> : null}
      </div>
      <DisclosureButton id={contentId} title={`la demande de ${request.requester_display_name}`} open={open} onToggle={() => setOpen(!open)} />
    </div>
    <DisclosureContent id={contentId} open={open}>{children}</DisclosureContent>
  </article>;
}

export function ExtraListeningTable({
  drawNumber,
  requests,
  member,
  isAdmin,
  focusRequestId,
  onOpen,
  onDelete,
}: {
  drawNumber: number;
  requests: ExtraListeningRequest[];
  member: SignedMember | null;
  isAdmin: boolean;
  focusRequestId?: string | null;
  onOpen: (requestId: string, mode: "propose" | "listen" | "view") => void;
  onDelete: (requestId: string) => void;
}) {
  const rows = requests
    .filter((request) => request.draw_number === drawNumber)
    .sort((first, second) => second.requested_at.localeCompare(first.requested_at));
  const contentId = `extra-listenings-content-${drawNumber}`;
  const { open, setOpen } = useStoredDisclosure(`extra-listenings:${drawNumber}`, member?.id);
  const focused = rows.some((row) => row.id === focusRequestId) ? focusRequestId : null;
  const pending = rows.some((row) => member && (
    row.status === "pending_proposal" && isSameMember(row.proposer_username, member.username)
    || ["album_proposed", "listening"].includes(row.status) && isSameMember(row.requester_username, member.username)
  ));

  useEffect(() => {
    if (!focused) return;
    setOpen(true);
    const frame = requestAnimationFrame(() => {
      const row = document.getElementById(`extra-listening-row-${focused}`);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focused, setOpen]);

  return (
    <section className={styles.attachedTable} aria-labelledby={`extra-listenings-title-${drawNumber}`}>
      <div className={styles.attachedHeading}>
        <div>
          <span className={styles.outsideLabel}>HORS TIRAGE CLASSIQUE</span>
          <h3 id={`extra-listenings-title-${drawNumber}`}>
            Écoutes supplémentaires du tirage {formatDraw(drawNumber)}
          </h3>
        </div>
        <div className={collapseStyles.headingRow}>
          <span>{rows.length} demande{rows.length > 1 ? "s" : ""}{pending ? " · Action attendue" : ""}</span>
          <DisclosureButton id={contentId} title="les écoutes supplémentaires" open={open} onToggle={() => setOpen(!open)} />
        </div>
      </div>
      {!open && rows.length > 0 ? <p className={styles.emptyAttached}>{rows.map((row) => row.requester_display_name).join(" · ")}</p> : null}
      <DisclosureContent id={contentId} open={open || Boolean(focused)}>
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
                  <tr key={request.id} id={`extra-listening-row-${request.id}`} tabIndex={-1} className={request.id === focused ? "sheet-row--focused" : undefined}>
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
      </DisclosureContent>
    </section>
  );
}

export function ExtraListeningWorkspace({
  draws,
  member,
  focusedRequestId,
  onChanged,
  onProposed,
}: {
  draws: DrawOption[];
  member: SignedMember;
  focusedRequestId: string | null;
  onChanged?: () => void;
  onProposed: (requestId: string) => Promise<void>;
}) {
  const configured = isSupabaseConfigured();
  const consumedFocus = useRef<string | null>(null);
  const submittingProposal = useRef(false);
  const [requests, setRequests] = useState<ExtraListeningRequest[]>([]);
  const [proposerUsername, setProposerUsername] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const { open, setOpen } = useStoredDisclosure("extra-listening-workspace", member.id);
  const collapsed = !open;

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
    setOpen(true);
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`extra-request-${focusedRequestId}`);
      if (!target) return;
      consumedFocus.current = focusedRequestId;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedRequestId, requests, setOpen]);

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
    if (!configured || submittingProposal.current) return;
    submittingProposal.current = true;
    setSavingId(payload.entryId);
    setNotice("");
    let coverPath: string | null = null;
    try {
      if (payload.file) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(payload.file.type) || payload.file.size > 5 * 1024 * 1024) {
          throw new Error("Choisis une image JPG, PNG ou WebP de 5 Mo maximum.");
        }
        const extension = payload.file.type === "image/jpeg" ? "jpg" : payload.file.type.slice("image/".length);
        coverPath = `${member.id}/extra/${payload.entryId}.${extension}`;
        const { error } = await getSupabaseBrowserClient().storage
          .from("album-covers")
          .upload(coverPath, payload.file, {
            upsert: true,
            contentType: payload.file.type,
            cacheControl: "60",
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
      await onProposed(payload.entryId);
    } catch (error) {
      setNotice(error && typeof error === "object" && "message" in error ? String(error.message) : "L’album n’a pas pu être proposé.");
    } finally {
      submittingProposal.current = false;
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
            {!collapsed ? <p>Choisis un membre du tirage actuel pour te proposer un album.</p> : <small>{member.displayName} · {ownRequests.length} demande(s){assignedRequests.some((request) => request.status === "pending_proposal") ? " · Une proposition est attendue" : ""}</small>}
          </div>
          <DisclosureButton id="extra-listening-workspace-content" title="les demandes d’écoute" open={open} onToggle={() => setOpen(!open)} />
        </div>
      </header>

      <DisclosureContent id="extra-listening-workspace-content" open={open}>
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
            <ExtraRequestCard key={request.id} request={request} memberId={member.id} focused={focusedRequestId === request.id}
              action={request.status === "pending_proposal" ? "Album à proposer" : undefined}
              summary={<p><strong>{request.requester_display_name}</strong> te demande un album pour le tirage {formatDraw(request.draw_number)}.</p>}>
              <div className={styles.taskMeta}>
                <small>Demandé le {formatDate(request.requested_at)} · Cette proposition reste séparée du tirage classique.</small>
                {request.message ? <blockquote>« {request.message} »</blockquote> : null}
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
            </ExtraRequestCard>
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
            <ExtraRequestCard key={request.id} request={request} memberId={member.id} focused={focusedRequestId === request.id}
              action={request.status === "album_proposed" || request.status === "listening" ? "Écoute ou verdict attendu" : undefined}
              summary={<p><strong>{request.requester_display_name}</strong> · Tirage {formatDraw(request.draw_number)} · demandé à {request.proposer_display_name}{request.album_title ? ` · ${request.album_title}` : ""}</p>}>
              <div className={styles.taskMeta}>
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
            </ExtraRequestCard>
          )) : <p className={styles.empty}>Tu n’as encore demandé aucune écoute supplémentaire.</p>}
        </div>
      </section>
      </DisclosureContent>
    </section>
  );
}
