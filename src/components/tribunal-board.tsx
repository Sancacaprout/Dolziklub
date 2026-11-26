"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import styles from "@/app/tribunal/tribunal.module.css";
import {
  tribunalStampMessages,
  tribunalStatusLabels,
  type TribunalAlbum,
  type TribunalAnswer,
  type TribunalContext,
  type TribunalParticipant,
  type TribunalQuestion,
  type TribunalQuestionResult,
  type TribunalResults,
  type TribunalReview,
  type TribunalStatus,
} from "@/lib/tribunal";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Phase = "intro" | "question" | "reveal" | "complete" | "results";
type DraftAnswer = {
  targetParticipantId: string;
  targetAlbumId: string;
  targetReviewId: string;
  freeText: string;
};

const emptyDraft: DraftAnswer = {
  targetParticipantId: "",
  targetAlbumId: "",
  targetReviewId: "",
  freeText: "",
};

function drawLabel(drawNumber: number) {
  return String(drawNumber).padStart(2, "0");
}

function normalise(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function answerToDraft(answer: TribunalAnswer | null): DraftAnswer {
  return {
    targetParticipantId: answer?.targetParticipantId ?? "",
    targetAlbumId: answer?.targetAlbumId ?? "",
    targetReviewId: answer?.targetReviewId ?? "",
    freeText: answer?.freeText ?? "",
  };
}

function isJokerAnswer(answer: TribunalAnswer | null) {
  return Boolean(answer?.isJoker || (
    answer
    && answer.targetParticipantId === null
    && answer.targetAlbumId === null
    && answer.targetReviewId === null
    && answer.freeText === null
  ));
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase();
}

function resultHeading(result: TribunalQuestionResult) {
  if (result.position === 1) return "LES GOÛTS LES PLUS MERDIQUES";
  if (result.position === 6) return "LE PLUS GROS FRAUDEUR MUSICAL";
  if (result.position === 14) return "LA PROPOSITION QUI A BRISÉ LE GROUPE";
  if (result.position === 16) return "LA NOTE QUI MÉRITE UNE ENQUÊTE";
  return `DOSSIER ${String(result.position).padStart(2, "0")}`;
}

function statusAction(status: TribunalStatus) {
  if (status === "draft") return { next: "open" as const, label: "OUVRIR L’ÉDITION" };
  if (status === "open") return { next: "closed" as const, label: "FERMER L’ÉDITION" };
  return null;
}

function describeError(error: unknown, fallback: string) {
  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;
}

export function TribunalBoard() {
  const configured = isSupabaseConfigured();
  const [context, setContext] = useState<TribunalContext | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [draft, setDraft] = useState<DraftAnswer>(emptyDraft);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [message, setMessage] = useState("");
  const [stamp, setStamp] = useState("");
  const [results, setResults] = useState<TribunalResults | null>(null);
  const resultsRequest = useRef<AbortController | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [editionTitle, setEditionTitle] = useState("Le Tribunal — Nouvelle édition");

  const loadContext = useCallback(async (sessionId: number | null = null) => {
    resultsRequest.current?.abort();
    if (!configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setSignedOut(true);
        setContext(null);
        return;
      }
      setSignedOut(false);
      const { data, error } = await supabase.rpc("get_tribunal_context_v3", { p_session_id: sessionId });
      if (error) throw error;
      const next = data as TribunalContext;
      setContext(next);
      const active = next.questions.filter((question) => question.isActive);
      const firstMissing = active.findIndex((question) => !question.answer);
      setQuestionIndex(firstMissing < 0 ? Math.max(active.length - 1, 0) : firstMissing);
      setPhase("intro");
      setResults(null);
    } catch (error) {
      setMessage(describeError(error, "Le dossier n’a pas pu être chargé."));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadContext(), 0);
    return () => {
      window.clearTimeout(timeoutId);
      resultsRequest.current?.abort();
    };
  }, [loadContext]);

  const questions = useMemo(
    () => context?.questions.filter((question) => question.isActive) ?? [],
    [context?.questions],
  );
  const question = questions[questionIndex] ?? null;
  const completedCount = questions.filter((item) => item.answer).length;
  const jokerUsed = questions.some((item) => isJokerAnswer(item.answer));
  const currentIsJoker = isJokerAnswer(question?.answer ?? null);
  const answeredCount = completedCount - (jokerUsed ? 1 : 0);
  const progress = questions.length ? Math.round((completedCount / questions.length) * 100) : 0;
  const viewerCompleted = questions.length > 0 && completedCount === questions.length;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDraft(answerToDraft(question?.answer ?? null));
      setSearch("");
      setStamp("");
      setMessage("");
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // Reset only when navigating to another question, not when saving the current answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  const memberOptions = useMemo(
    () => context?.participants.filter((participant) => participant.id !== context.viewerId) ?? [],
    [context],
  );
  const filteredAlbums = useMemo(() => {
    const needle = normalise(search.trim());
    if (!needle) return context?.albums ?? [];
    return (context?.albums ?? []).filter((album) => normalise(`${album.title} ${album.artist} ${album.proposedBy ?? ""}`).includes(needle));
  }, [context?.albums, search]);
  const filteredReviews = useMemo(() => {
    const needle = normalise(search.trim());
    if (!needle) return context?.reviews ?? [];
    return (context?.reviews ?? []).filter((review) => normalise(`${review.albumTitle} ${review.artist} ${review.memberName} ${review.reviewTitle ?? ""} ${review.reviewExcerpt}`).includes(needle));
  }, [context?.reviews, search]);

  const avatarUrl = (participant: TribunalParticipant) => {
    if (!participant.avatarPath) return null;
    const base = getSupabaseBrowserClient().storage.from("member-avatars").getPublicUrl(participant.avatarPath).data.publicUrl;
    return `${base}?v=${encodeURIComponent(participant.avatarUpdatedAt ?? participant.avatarPath)}`;
  };
  const evidenceCover = (evidence: { coverPath: string | null; coverSourceUrl: string | null }) => evidence.coverPath
    ? getSupabaseBrowserClient().storage.from("album-covers").getPublicUrl(evidence.coverPath).data.publicUrl
    : evidence.coverSourceUrl;

  const canSave = Boolean(question && !currentIsJoker && (
    question.type === "member" ? draft.targetParticipantId
      : question.type === "member_text" ? draft.targetParticipantId && draft.freeText.trim() && draft.freeText.trim().length <= (question.config.maxLength ?? 160)
        : question.type === "album" ? draft.targetAlbumId
          : draft.targetReviewId
  ));
  const resultSessionId = context?.session?.id ?? null;
  const finishesQuestionnaire = questions.every((item) => item.id === question?.id || item.answer);

  const loadResults = useCallback(async (withReveal = false) => {
    if (resultSessionId === null) return;
    resultsRequest.current?.abort();
    const request = new AbortController();
    resultsRequest.current = request;
    const revealStartedAt = Date.now();
    if (withReveal) setPhase("reveal");
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc("get_tribunal_results_v3", {
        p_session_id: resultSessionId,
      }).abortSignal(request.signal);
      if (error) throw error;
      if (withReveal) {
        const remainingRevealTime = Math.max(0, 1800 - (Date.now() - revealStartedAt));
        await new Promise((resolve) => setTimeout(resolve, remainingRevealTime));
      }
      if (request.signal.aborted) return;
      setResults(data as TribunalResults);
      setPhase("results");
    } catch (error) {
      if (request.signal.aborted) return;
      if (withReveal) setPhase("complete");
      setMessage(describeError(error, "Impossible de charger les résultats. Réessaie sans perdre tes réponses."));
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [resultSessionId]);

  useEffect(() => {
    if (phase !== "results" || !results || results.progress.isComplete) return;
    const intervalId = window.setInterval(() => void loadResults(), 30_000);
    return () => window.clearInterval(intervalId);
  }, [loadResults, phase, results]);

  const start = () => {
    const firstMissing = questions.findIndex((item) => !item.answer);
    if (firstMissing < 0) {
      void loadResults(true);
      return;
    }
    setQuestionIndex(firstMissing);
    setPhase("question");
  };

  const advanceAfterSave = async (answer: TribunalAnswer, stampMessage: string) => {
    if (!question) return;
    const nextMissing = questions.findIndex((item) => item.id !== question.id && !item.answer);
    setContext((current) => {
      if (!current?.session || current.session.id !== resultSessionId) return current;
      const nextQuestions = current.questions.map((item) => item.id === question.id ? { ...item, answer } : item);
      return {
        ...current,
        questions: nextQuestions,
        session: {
          ...current.session,
          completedCount: nextQuestions.filter((item) => item.isActive && item.answer).length,
        },
      };
    });
    setStamp(stampMessage);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (nextMissing === -1) await loadResults(true);
    else setQuestionIndex(nextMissing);
  };

  const saveAnswer = async () => {
    if (!context?.session || !question || !canSave || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc("save_my_tribunal_response_v2", {
        p_session_id: context.session.id,
        p_question_id: question.id,
        p_target_participant_id: draft.targetParticipantId || null,
        p_target_album_id: draft.targetAlbumId || null,
        p_target_review_id: draft.targetReviewId || null,
        p_free_text: draft.freeText.trim() || null,
      });
      if (error) throw error;
      await advanceAfterSave(data as TribunalAnswer, tribunalStampMessages[(question.position - 1) % tribunalStampMessages.length]);
    } catch (error) {
      setMessage(describeError(error, "La réponse n’a pas pu être enregistrée."));
    } finally {
      setSaving(false);
    }
  };

  const spendJoker = async () => {
    if (!context?.session || !question || question.answer || jokerUsed || saving) return;
    if (!confirm("Utiliser ton unique joker pour cette édition ? Cette question sera définitivement passée.")) return;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc("use_my_tribunal_joker", {
        p_session_id: context.session.id,
        p_question_id: question.id,
      });
      if (error) throw error;
      await advanceAfterSave(data as TribunalAnswer, "JOKER UTILISÉ · DOSSIER CLASSÉ SANS SUITE");
    } catch (error) {
      setMessage(describeError(error, "Le joker n’a pas pu être utilisé."));
    } finally {
      setSaving(false);
    }
  };

  const adminCreateEdition = async (event: FormEvent) => {
    event.preventDefault();
    if (!editionTitle.trim()) return;
    setSaving(true);
    const { data, error } = await getSupabaseBrowserClient().rpc("admin_create_tribunal_session", {
      p_title: editionTitle.trim(),
      p_opens_at: null,
    });
    setSaving(false);
    if (error) setMessage(error.message);
    else await loadContext(Number(data));
  };

  const adminSetStatus = async (status: "open" | "closed") => {
    if (!context?.session || !confirm(`Confirmer : ${status === "open" ? "ouvrir" : "fermer"} « ${context.session.title} » ?`)) return;
    setSaving(true);
    const { error } = await getSupabaseBrowserClient().rpc("admin_set_tribunal_session_status", {
      p_session_id: context.session.id,
      p_status: status,
    });
    setSaving(false);
    if (error) setMessage(error.message);
    else await loadContext(context.session.id);
  };

  const adminToggleQuestion = async (target: TribunalQuestion) => {
    const { error } = await getSupabaseBrowserClient().rpc("admin_set_tribunal_question_active", {
      p_question_id: target.id,
      p_is_active: !target.isActive,
    });
    if (error) setMessage(error.message);
    else await loadContext(context?.session?.id ?? null);
  };

  const adminToggleResponse = async (responseId: number, hidden: boolean) => {
    const { error } = await getSupabaseBrowserClient().rpc("admin_set_tribunal_response_hidden", {
      p_response_id: responseId,
      p_hidden: hidden,
    });
    if (error) setMessage(error.message);
    else await loadContext(context?.session?.id ?? null);
  };

  if (loading && !context) return <div className={styles.loading}>OUVERTURE DES DOSSIERS…</div>;

  const intro = (
    <section className={styles.intro} aria-labelledby="tribunal-title">
      <div className={styles.introCopy}>
        <p className={styles.kicker}>DOSSIER CONFIDENTIEL · MEMBRES MAJEURS ET CONSENTANTS</p>
        <h1 id="tribunal-title">LE<br /><em>TRIBUNAL</em></h1>
        <p className={styles.subtitle}>Balance tes pires vérités sur les goûts du club.</p>
        <p className={styles.lede}>16 questions. Aucun goût musical ne sortira intact.</p>
        {context?.session ? <div className={styles.sessionLine}><span className={`${styles.status} ${styles[`status_${context.session.status}`]}`}>{tribunalStatusLabels[context.session.status]}</span><b>{context.session.title}</b></div> : null}
        {signedOut ? <Link href="/connexion" className={styles.primaryAction}>SE CONNECTER POUR ENTRER</Link> : null}
        {context?.session && viewerCompleted && context.session.status !== "draft" ? <button type="button" className={styles.primaryAction} disabled={loading} onClick={() => void loadResults(true)}>VOIR LES RÉSULTATS</button> : null}
        {context?.session?.status === "open" && !viewerCompleted && questions.length > 0 ? <button type="button" className={styles.primaryAction} disabled={loading} onClick={start}>{completedCount ? `REPRENDRE LE TRIBUNAL · ${completedCount} / ${questions.length}` : "LANCER LE TRIBUNAL"}</button> : null}
        {context?.session && !viewerCompleted && (context.session.status === "closed" || context.session.status === "results_revealed") ? <p className={styles.waiting}>L’édition est close. Seuls les participants qui ont terminé peuvent consulter les résultats.</p> : null}
        {context && !context.isAdmin && context.session && context.sessions.length > 1 ? <label className={styles.search}><span>Historique des éditions</span><select value={context.session.id} disabled={loading} onChange={(event) => void loadContext(Number(event.target.value))}>{context.sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}</select></label> : null}
        {!signedOut && !context?.session ? <p className={styles.waiting}>Aucune édition n’est disponible pour le moment.</p> : null}
        {message ? <p className={styles.error} role="alert">{message}</p> : null}
      </div>
      <div className={styles.evidenceStack} aria-hidden="true"><span>PIÈCE À CONVICTION</span><b>16</b><i>QUESTIONS</i><strong>ANONYME</strong></div>
    </section>
  );

  return <div className={styles.page}>
    {phase === "intro" ? intro : null}

    {phase === "question" && question ? <section className={styles.caseFile} aria-labelledby="tribunal-question">
      <header className={styles.progressHeader}>
        <div><span>QUESTION {String(question.position).padStart(2, "0")}</span><b>{questionIndex + 1} / {questions.length}</b></div>
        <div className={styles.progressTrack} aria-label={`${completedCount} réponses sur ${questions.length}`}><i style={{ "--progress": `${Math.max(progress, Math.round((questionIndex / questions.length) * 100))}%` } as CSSProperties} /></div>
      </header>
      <div className={styles.questionCard} key={question.id}>
        <span className={styles.exhibit}>PIÈCE N° {String(question.position).padStart(2, "0")}</span>
        <h2 id="tribunal-question">{question.prompt}</h2>
        {currentIsJoker ? <div className={styles.jokerNotice} role="status"><b>JOKER UTILISÉ</b><span>Cette question est classée sans réponse. Ton joker est consommé pour cette édition.</span></div> : null}

        {!currentIsJoker && (question.type === "member" || question.type === "member_text") ? <div className={styles.memberGrid}>{memberOptions.map((participant) => {
          const avatar = avatarUrl(participant);
          const selected = draft.targetParticipantId === participant.id;
          return <button key={participant.id} type="button" className={`${styles.memberChoice} ${selected ? styles.selected : ""}`} aria-pressed={selected} onClick={() => setDraft((current) => ({ ...current, targetParticipantId: participant.id }))}>{avatar ? <img src={avatar} alt="" /> : <span aria-hidden="true">{initials(participant.displayName)}</span>}<b>{participant.displayName}</b><small>@{participant.username}</small>{selected ? <i>SÉLECTIONNÉ</i> : null}</button>;
        })}</div> : null}

        {!currentIsJoker && question.type === "member_text" ? <label className={styles.freeText}><span>TA PHRASE</span><textarea value={draft.freeText} maxLength={question.config.maxLength ?? 160} placeholder={question.config.placeholder} onChange={(event) => setDraft((current) => ({ ...current, freeText: event.target.value }))} />{question.position === 13 && draft.targetParticipantId && draft.freeText.trim() ? <strong>Les goûts de {memberOptions.find((member) => member.id === draft.targetParticipantId)?.displayName} ressemblent à {draft.freeText.trim()}</strong> : null}<small>{draft.freeText.length} / {question.config.maxLength ?? 160}</small></label> : null}

        {!currentIsJoker && question.type === "album" ? <ChoiceSearch value={search} onChange={setSearch} label="Chercher un album ou un artiste" /> : null}
        {!currentIsJoker && question.type === "album" ? <div className={styles.albumGrid}>{filteredAlbums.map((album) => <AlbumChoice key={album.id} album={album} cover={evidenceCover(album)} selected={draft.targetAlbumId === album.id} onSelect={() => setDraft((current) => ({ ...current, targetAlbumId: album.id }))} />)}</div> : null}

        {!currentIsJoker && question.type === "review" ? <ChoiceSearch value={search} onChange={setSearch} label="Chercher un album, un membre ou un avis" /> : null}
        {!currentIsJoker && question.type === "review" ? <div className={styles.reviewGrid}>{filteredReviews.map((review) => <ReviewChoice key={review.id} review={review} cover={evidenceCover(review)} selected={draft.targetReviewId === review.id} onSelect={() => setDraft((current) => ({ ...current, targetReviewId: review.id }))} />)}</div> : null}

        {stamp ? <p className={styles.stamp} role="status">{stamp}</p> : null}
        {message ? <p className={styles.error} role="alert">{message}</p> : null}
        <footer className={styles.questionActions}>
          {questionIndex > 0 ? <button type="button" disabled={saving} onClick={() => setQuestionIndex((index) => index - 1)}>QUESTION PRÉCÉDENTE</button> : <button type="button" disabled={saving} onClick={() => setPhase("intro")}>QUITTER LE DOSSIER</button>}
          {!jokerUsed && !question.answer ? <button type="button" className={styles.jokerAction} disabled={saving} onClick={() => void spendJoker()}>{saving ? "CLASSEMENT…" : "UTILISER MON JOKER · 1 FOIS"}</button> : null}
          {currentIsJoker ? (
            <button type="button" className={styles.validate} disabled={loading || saving} onClick={start}>
              {viewerCompleted ? "TERMINER ET VOIR LES RÉSULTATS" : "REPRENDRE LES QUESTIONS"}
            </button>
          ) : (
            <button type="button" className={styles.validate} disabled={!canSave || saving} onClick={() => void saveAnswer()}>
              {saving ? "ENREGISTREMENT…" : finishesQuestionnaire ? "TERMINER ET VOIR LES RÉSULTATS" : question.answer ? "METTRE À JOUR ET CONTINUER" : "VALIDER ET CONTINUER"}
            </button>
          )}
        </footer>
      </div>
    </section> : null}
    {phase === "reveal" ? <section className={styles.reveal} role="status" aria-live="polite"><div className={styles.revealDossier}><span>DOSSIER COMPLET</span><b>DÉCLASSIFICATION</b><i>RÉSULTATS ANONYMES EN COURS</i></div><div className={styles.revealBars} aria-hidden="true"><i /><i /><i /></div></section> : null}


    {phase === "complete" && context?.session ? <section className={styles.complete}><p className={styles.kicker}>DOSSIER DÉPOSÉ</p><h2>Tu as livré<br /><em>tes seize balles perdues.</em></h2><div><b>{answeredCount}</b><span>RÉPONSES ENREGISTRÉES{jokerUsed ? " · 1 JOKER UTILISÉ" : ""}</span></div><button type="button" className={styles.primaryAction} onClick={() => void loadResults(true)}>RÉESSAYER LA DÉCLASSIFICATION</button>{message ? <p className={styles.error} role="alert">{message}</p> : null}<button type="button" className={styles.textAction} onClick={() => { setQuestionIndex(0); setPhase("question"); }}>REVOIR MES RÉPONSES</button></section> : null}

    {phase === "results" && results ? <ResultsView results={results} refreshing={loading} error={message} onRefresh={() => void loadResults()} onBack={() => { resultsRequest.current?.abort(); setLoading(false); setPhase("intro"); }} /> : null}

    {context?.isAdmin ? <AdminPanel context={context} open={adminOpen} saving={saving} editionTitle={editionTitle} onOpen={() => setAdminOpen((value) => !value)} onEditionTitle={setEditionTitle} onCreate={adminCreateEdition} onSelectSession={(id) => void loadContext(id)} onSetStatus={(status) => void adminSetStatus(status)} onToggleQuestion={(target) => void adminToggleQuestion(target)} onToggleResponse={(id, hidden) => void adminToggleResponse(id, hidden)} onPreview={() => void loadResults()} /> : null}
  </div>;
}

function ChoiceSearch({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <label className={styles.search}><span>{label}</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Rechercher dans les preuves…" /></label>;
}

function AlbumChoice({ album, cover, selected, onSelect }: { album: TribunalAlbum; cover: string | null; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`${styles.albumChoice} ${selected ? styles.selected : ""}`} aria-pressed={selected} onClick={onSelect}>{cover ? <img src={cover} alt={`Pochette de ${album.title}`} /> : <span className={styles.coverFallback}>DOL<br />ZIKLUB</span>}<span><small>TIRAGE {drawLabel(album.drawNumber)} · PROPOSÉ PAR {album.proposedBy ?? "LE CLUB"}</small><b>{album.title}</b><em>{album.artist}</em></span>{selected ? <i>PREUVE RETENUE</i> : null}</button>;
}

function ReviewChoice({ review, cover, selected, onSelect }: { review: TribunalReview; cover: string | null; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`${styles.reviewChoice} ${selected ? styles.selected : ""}`} aria-pressed={selected} onClick={onSelect}>{cover ? <img src={cover} alt={`Pochette de ${review.albumTitle}`} /> : <span className={styles.reviewCoverFallback}>DOL<br />ZIKLUB</span>}<span><small>TIRAGE {drawLabel(review.drawNumber)} · {review.memberName}</small><b>{review.albumTitle}</b><em>{review.artist}</em></span><strong>{String(review.rating).replace(".", ",")} / 5</strong>{review.reviewTitle ? <h3>{review.reviewTitle}</h3> : null}<p>{review.reviewExcerpt}</p>{selected ? <i>NOTE SUSPECTE RETENUE</i> : null}</button>;
}

function ResultsView({ results, refreshing, error, onRefresh, onBack }: { results: TribunalResults; refreshing: boolean; error: string; onRefresh: () => void; onBack: () => void }) {
  const { completedParticipants, totalParticipants, isComplete } = results.progress;
  const completedLabel = `${completedParticipants} participant${totalParticipants === 1 ? "" : "s"} sur ${totalParticipants} ${totalParticipants === 1 ? "a" : "ont"} terminé`;
  return <section className={styles.results}>
    <header><p className={styles.kicker}>RÉSULTATS ANONYMES · DOSSIERS DÉCLASSIFIÉS</p><h1>AFFICHER<br /><em>LE CARNAGE</em></h1><p>{results.session.title}</p></header>
    <section className={`${styles.resultsProgress} ${results.progress.isComplete ? styles.resultsProgressComplete : ""}`} aria-live="polite">
      <div><strong>{isComplete ? "RÉSULTATS COMPLETS" : "RÉSULTATS PROVISOIRES"}</strong><span>{completedLabel}.</span>{!isComplete ? <small>Le dossier se met à jour automatiquement lorsque de nouvelles réponses arrivent.</small> : null}</div>
      <button type="button" disabled={refreshing} onClick={onRefresh}>{refreshing ? "ACTUALISATION…" : "ACTUALISER"}</button>
    </section>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {results.globalRanking.length ? <section className={styles.globalRanking}><span>CLASSEMENT GLOBAL</span><h2>LA PLUS GROSSE VICTIME DU TRIBUNAL</h2><ol>{results.globalRanking.slice(0, 5).map((item) => <li key={item.id}><b>{results.globalRanking.findIndex((entry) => entry.citations === item.citations) + 1}</b><span>{item.label}<small>@{item.username}</small></span><strong>{item.citations} citations</strong></li>)}</ol></section> : null}
    <div className={styles.resultList}>{results.questions.map((result) => <article key={result.id} className={styles.resultCard}><header><span>{resultHeading(result)}</span><b>{result.totalVotes} VOTE{result.totalVotes > 1 ? "S" : ""}</b></header><h2>{result.prompt}</h2>{result.ranking.length ? <ol>{result.ranking.map((item) => <li key={item.id}><strong>{result.ranking.findIndex((entry) => entry.votes === item.votes) + 1}</strong><div><b>{item.label}</b>{item.artist ? <small>{item.artist}</small> : null}{item.memberName ? <small>{item.memberName} · {String(item.rating).replace(".", ",")} / 5</small> : null}</div><span>{item.votes} · {item.percentage}%</span></li>)}</ol> : <p className={styles.empty}>Aucune preuve déposée.</p>}</article>)}</div>
    <button type="button" className={styles.textAction} onClick={onBack}>REVENIR À L’ACCUEIL DU TRIBUNAL</button>
  </section>;
}

function AdminPanel({ context, open, saving, editionTitle, onOpen, onEditionTitle, onCreate, onSelectSession, onSetStatus, onToggleQuestion, onToggleResponse, onPreview }: { context: TribunalContext; open: boolean; saving: boolean; editionTitle: string; onOpen: () => void; onEditionTitle: (value: string) => void; onCreate: (event: FormEvent) => void; onSelectSession: (id: number) => void; onSetStatus: (status: "open" | "closed") => void; onToggleQuestion: (question: TribunalQuestion) => void; onToggleResponse: (id: number, hidden: boolean) => void; onPreview: () => void }) {
  const action = context.session ? statusAction(context.session.status) : null;
  return <aside className={styles.admin}><button type="button" className={styles.adminToggle} aria-expanded={open} onClick={onOpen}>ADMINISTRATION DU TRIBUNAL · {context.session?.participationCount ?? 0} PARTICIPATION(S)</button>{open ? <div className={styles.adminBody}><section><h2>ÉDITIONS</h2>{context.sessions.length ? <label>Édition active<select value={context.session?.id ?? ""} onChange={(event) => onSelectSession(Number(event.target.value))}>{context.sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {tribunalStatusLabels[session.status]}</option>)}</select></label> : null}<form onSubmit={onCreate}><label>Titre de la nouvelle édition<input value={editionTitle} maxLength={120} onChange={(event) => onEditionTitle(event.target.value)} /></label><button type="submit" disabled={saving}>CRÉER LE BROUILLON</button></form>{action ? <button type="button" className={styles.dangerAction} disabled={saving} onClick={() => onSetStatus(action.next)}>{action.label}</button> : null}{context.session && context.session.status !== "draft" ? <button type="button" onClick={onPreview}>PRÉVISUALISER LES DÉGÂTS</button> : null}</section><section><h2>QUESTIONS</h2><ol className={styles.adminQuestions}>{context.questions.map((question) => <li key={question.id}><span><b>{question.position}</b>{question.prompt}</span><button type="button" onClick={() => onToggleQuestion(question)}>{question.isActive ? "DÉSACTIVER" : "RÉACTIVER"}</button></li>)}</ol></section><section><h2>MODÉRATION DES RÉPONSES LIBRES</h2>{context.moderation.length ? <ol className={styles.moderation}>{context.moderation.map((item) => <li key={item.id} className={item.isHidden ? styles.hiddenResponse : ""}><small>QUESTION {item.questionPosition} · {item.targetDisplayName ?? "SANS CIBLE"}</small><p>{item.freeText}</p><button type="button" onClick={() => onToggleResponse(item.id, !item.isHidden)}>{item.isHidden ? "RÉAFFICHER" : "MASQUER SANS SUPPRIMER"}</button></li>)}</ol> : <p>Aucune réponse libre à modérer.</p>}</section></div> : null}</aside>;
}
