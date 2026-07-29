"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
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

type Phase = "intro" | "question" | "complete" | "results";
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
  if (status === "closed") return { next: "results_revealed" as const, label: "RÉVÉLER LES RÉSULTATS" };
  return null;
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
  const [adminOpen, setAdminOpen] = useState(false);
  const [editionTitle, setEditionTitle] = useState("Le Tribunal — Nouvelle édition");

  const loadContext = useCallback(async (sessionId: number | null = null) => {
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
      const { data, error } = await supabase.rpc("get_tribunal_context", { p_session_id: sessionId });
      if (error) throw error;
      const next = data as TribunalContext;
      setContext(next);
      const active = next.questions.filter((question) => question.isActive);
      const firstMissing = active.findIndex((question) => !question.answer);
      setQuestionIndex(firstMissing < 0 ? Math.max(active.length - 1, 0) : firstMissing);
      setPhase("intro");
      setResults(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Le dossier n’a pas pu être chargé.");
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadContext(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadContext]);

  const questions = useMemo(
    () => context?.questions.filter((question) => question.isActive) ?? [],
    [context?.questions],
  );
  const question = questions[questionIndex] ?? null;
  const completedCount = questions.filter((item) => item.answer).length;
  const progress = questions.length ? Math.round((completedCount / questions.length) * 100) : 0;

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
    return (context?.reviews ?? []).filter((review) => normalise(`${review.albumTitle} ${review.artist} ${review.memberName} ${review.reviewTitle ?? ""}`).includes(needle));
  }, [context?.reviews, search]);

  const avatarUrl = (participant: TribunalParticipant) => {
    if (!participant.avatarPath) return null;
    const base = getSupabaseBrowserClient().storage.from("member-avatars").getPublicUrl(participant.avatarPath).data.publicUrl;
    return `${base}?v=${encodeURIComponent(participant.avatarUpdatedAt ?? participant.avatarPath)}`;
  };
  const albumCover = (album: TribunalAlbum) => album.coverPath
    ? getSupabaseBrowserClient().storage.from("album-covers").getPublicUrl(album.coverPath).data.publicUrl
    : album.coverSourceUrl;

  const canSave = Boolean(question && (
    question.type === "member" ? draft.targetParticipantId
      : question.type === "member_text" ? draft.targetParticipantId && draft.freeText.trim() && draft.freeText.trim().length <= (question.config.maxLength ?? 160)
        : question.type === "album" ? draft.targetAlbumId
          : draft.targetReviewId
  ));

  const start = () => {
    const firstMissing = questions.findIndex((item) => !item.answer);
    setQuestionIndex(firstMissing < 0 ? 0 : firstMissing);
    setPhase(firstMissing < 0 ? "complete" : "question");
  };

  const saveAnswer = async () => {
    if (!context?.session || !question || !canSave || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc("save_my_tribunal_response", {
        p_session_id: context.session.id,
        p_question_id: question.id,
        p_target_participant_id: draft.targetParticipantId || null,
        p_target_album_id: draft.targetAlbumId || null,
        p_target_review_id: draft.targetReviewId || null,
        p_free_text: draft.freeText.trim() || null,
      });
      if (error) throw error;
      const saved = data as TribunalAnswer;
      setContext((current) => {
        if (!current?.session) return current;
        const nextQuestions = current.questions.map((item) => item.id === question.id ? { ...item, answer: saved } : item);
        return {
          ...current,
          questions: nextQuestions,
          session: {
            ...current.session,
            completedCount: nextQuestions.filter((item) => item.isActive && item.answer).length,
          },
        };
      });
      setStamp(tribunalStampMessages[(question.position - 1) % tribunalStampMessages.length]);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (questionIndex >= questions.length - 1) setPhase("complete");
      else setQuestionIndex((index) => index + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La réponse n’a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  };

  const loadResults = async () => {
    if (!context?.session) return;
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc("get_tribunal_results", { p_session_id: context.session.id });
      if (error) throw error;
      setResults(data as TribunalResults);
      setPhase("results");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Les dégâts ne sont pas encore consultables.");
    } finally {
      setLoading(false);
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

  const adminSetStatus = async (status: "open" | "closed" | "results_revealed") => {
    if (!context?.session || !confirm(`Confirmer : ${status === "open" ? "ouvrir" : status === "closed" ? "fermer" : "révéler les résultats de"} « ${context.session.title} » ?`)) return;
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
        {!signedOut && context?.session?.status === "open" ? <button type="button" className={styles.primaryAction} onClick={start}>{completedCount ? `REPRENDRE LE TRIBUNAL · ${completedCount} / ${questions.length}` : "LANCER LE TRIBUNAL"}</button> : null}
        {!signedOut && context?.session?.status === "closed" ? <p className={styles.waiting}>L’édition est close. Les dossiers restent scellés jusqu’à la révélation.</p> : null}
        {!signedOut && context?.session?.status === "results_revealed" ? <button type="button" className={styles.primaryAction} onClick={() => void loadResults()}>AFFICHER LE CARNAGE</button> : null}
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

        {(question.type === "member" || question.type === "member_text") ? <div className={styles.memberGrid}>{memberOptions.map((participant) => {
          const avatar = avatarUrl(participant);
          const selected = draft.targetParticipantId === participant.id;
          return <button key={participant.id} type="button" className={`${styles.memberChoice} ${selected ? styles.selected : ""}`} aria-pressed={selected} onClick={() => setDraft((current) => ({ ...current, targetParticipantId: participant.id }))}>{avatar ? <img src={avatar} alt="" /> : <span aria-hidden="true">{initials(participant.displayName)}</span>}<b>{participant.displayName}</b><small>@{participant.username}</small>{selected ? <i>SÉLECTIONNÉ</i> : null}</button>;
        })}</div> : null}

        {question.type === "member_text" ? <label className={styles.freeText}><span>TA PHRASE</span><textarea value={draft.freeText} maxLength={question.config.maxLength ?? 160} placeholder={question.config.placeholder} onChange={(event) => setDraft((current) => ({ ...current, freeText: event.target.value }))} />{question.position === 13 && draft.targetParticipantId && draft.freeText.trim() ? <strong>Les goûts de {memberOptions.find((member) => member.id === draft.targetParticipantId)?.displayName} ressemblent à {draft.freeText.trim()}</strong> : null}<small>{draft.freeText.length} / {question.config.maxLength ?? 160}</small></label> : null}

        {question.type === "album" ? <ChoiceSearch value={search} onChange={setSearch} label="Chercher un album ou un artiste" /> : null}
        {question.type === "album" ? <div className={styles.albumGrid}>{filteredAlbums.map((album) => <AlbumChoice key={album.id} album={album} cover={albumCover(album)} selected={draft.targetAlbumId === album.id} onSelect={() => setDraft((current) => ({ ...current, targetAlbumId: album.id }))} />)}</div> : null}

        {question.type === "review" ? <ChoiceSearch value={search} onChange={setSearch} label="Chercher un album, un membre ou un avis" /> : null}
        {question.type === "review" ? <div className={styles.reviewGrid}>{filteredReviews.map((review) => <ReviewChoice key={review.id} review={review} selected={draft.targetReviewId === review.id} onSelect={() => setDraft((current) => ({ ...current, targetReviewId: review.id }))} />)}</div> : null}

        {stamp ? <p className={styles.stamp} role="status">{stamp}</p> : null}
        {message ? <p className={styles.error} role="alert">{message}</p> : null}
        <footer className={styles.questionActions}>{questionIndex > 0 ? <button type="button" onClick={() => setQuestionIndex((index) => index - 1)}>QUESTION PRÉCÉDENTE</button> : <button type="button" onClick={() => setPhase("intro")}>QUITTER LE DOSSIER</button>}<button type="button" className={styles.validate} disabled={!canSave || saving} onClick={() => void saveAnswer()}>{saving ? "ENREGISTREMENT…" : question.answer ? "METTRE À JOUR ET CONTINUER" : "VALIDER ET CONTINUER"}</button></footer>
      </div>
    </section> : null}

    {phase === "complete" && context?.session ? <section className={styles.complete}><p className={styles.kicker}>DOSSIER DÉPOSÉ</p><h2>Tu as livré<br /><em>tes seize balles perdues.</em></h2><div><b>{completedCount}</b><span>RÉPONSES ENREGISTRÉES</span></div>{context.session.status === "results_revealed" ? <button type="button" className={styles.primaryAction} onClick={() => void loadResults()}>VOIR LES DÉGÂTS</button> : <p>Les résultats apparaîtront quand l’administration aura fermé puis révélé l’édition.</p>}<button type="button" className={styles.textAction} onClick={() => { setQuestionIndex(0); setPhase("question"); }}>REVOIR MES RÉPONSES</button></section> : null}

    {phase === "results" && results ? <ResultsView results={results} onBack={() => setPhase("intro")} /> : null}

    {context?.isAdmin ? <AdminPanel context={context} open={adminOpen} saving={saving} editionTitle={editionTitle} onOpen={() => setAdminOpen((value) => !value)} onEditionTitle={setEditionTitle} onCreate={adminCreateEdition} onSelectSession={(id) => void loadContext(id)} onSetStatus={(status) => void adminSetStatus(status)} onToggleQuestion={(target) => void adminToggleQuestion(target)} onToggleResponse={(id, hidden) => void adminToggleResponse(id, hidden)} onPreview={() => void loadResults()} /> : null}
  </div>;
}

function ChoiceSearch({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <label className={styles.search}><span>{label}</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Rechercher dans les preuves…" /></label>;
}

function AlbumChoice({ album, cover, selected, onSelect }: { album: TribunalAlbum; cover: string | null; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`${styles.albumChoice} ${selected ? styles.selected : ""}`} aria-pressed={selected} onClick={onSelect}>{cover ? <img src={cover} alt={`Pochette de ${album.title}`} /> : <span className={styles.coverFallback}>DOL<br />ZIKLUB</span>}<span><small>TIRAGE {drawLabel(album.drawNumber)} · PROPOSÉ PAR {album.proposedBy ?? "LE CLUB"}</small><b>{album.title}</b><em>{album.artist}</em></span>{selected ? <i>PREUVE RETENUE</i> : null}</button>;
}

function ReviewChoice({ review, selected, onSelect }: { review: TribunalReview; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`${styles.reviewChoice} ${selected ? styles.selected : ""}`} aria-pressed={selected} onClick={onSelect}><span><small>TIRAGE {drawLabel(review.drawNumber)} · {review.memberName}</small><b>{review.albumTitle}</b><em>{review.artist}</em></span><strong>{String(review.rating).replace(".", ",")} / 5</strong>{review.reviewTitle ? <h3>{review.reviewTitle}</h3> : null}<p>{review.reviewExcerpt}</p>{selected ? <i>NOTE SUSPECTE RETENUE</i> : null}</button>;
}

function ResultsView({ results, onBack }: { results: TribunalResults; onBack: () => void }) {
  return <section className={styles.results}><header><p className={styles.kicker}>RÉSULTATS ANONYMES · DOSSIERS DÉCLASSIFIÉS</p><h1>AFFICHER<br /><em>LE CARNAGE</em></h1><p>{results.session.title}</p></header>{results.globalRanking.length ? <section className={styles.globalRanking}><span>CLASSEMENT GLOBAL</span><h2>LA PLUS GROSSE VICTIME DU TRIBUNAL</h2><ol>{results.globalRanking.slice(0, 5).map((item, index) => <li key={item.id}><b>{index + 1}</b><span>{item.label}<small>@{item.username}</small></span><strong>{item.citations} citations</strong></li>)}</ol></section> : null}<div className={styles.resultList}>{results.questions.map((result) => <article key={result.id} className={styles.resultCard}><header><span>{resultHeading(result)}</span><b>{result.totalVotes} VOTE{result.totalVotes > 1 ? "S" : ""}</b></header><h2>{result.prompt}</h2>{result.ranking.length ? <ol>{result.ranking.map((item, index) => <li key={item.id}><strong>{index + 1}</strong><div><b>{item.label}</b>{item.artist ? <small>{item.artist}</small> : null}{item.memberName ? <small>{item.memberName} · {String(item.rating).replace(".", ",")} / 5</small> : null}</div><span>{item.votes} · {item.percentage}%</span></li>)}</ol> : <p className={styles.empty}>Aucune preuve déposée.</p>}{result.freeAnswers.length ? <div className={styles.freeAnswers}>{result.freeAnswers.map((answer, index) => <blockquote key={`${result.id}-${index}`}>{result.position === 13 ? <>Les goûts de <b>{answer.targetDisplayName}</b> ressemblent à {answer.text}</> : <><b>{answer.targetDisplayName}</b> — {answer.text}</>}</blockquote>)}</div> : null}</article>)}</div><button type="button" className={styles.textAction} onClick={onBack}>REVENIR À L’ACCUEIL DU TRIBUNAL</button></section>;
}

function AdminPanel({ context, open, saving, editionTitle, onOpen, onEditionTitle, onCreate, onSelectSession, onSetStatus, onToggleQuestion, onToggleResponse, onPreview }: { context: TribunalContext; open: boolean; saving: boolean; editionTitle: string; onOpen: () => void; onEditionTitle: (value: string) => void; onCreate: (event: FormEvent) => void; onSelectSession: (id: number) => void; onSetStatus: (status: "open" | "closed" | "results_revealed") => void; onToggleQuestion: (question: TribunalQuestion) => void; onToggleResponse: (id: number, hidden: boolean) => void; onPreview: () => void }) {
  const action = context.session ? statusAction(context.session.status) : null;
  return <aside className={styles.admin}><button type="button" className={styles.adminToggle} aria-expanded={open} onClick={onOpen}>ADMINISTRATION DU TRIBUNAL · {context.session?.participationCount ?? 0} PARTICIPATION(S)</button>{open ? <div className={styles.adminBody}><section><h2>ÉDITIONS</h2>{context.sessions.length ? <label>Édition active<select value={context.session?.id ?? ""} onChange={(event) => onSelectSession(Number(event.target.value))}>{context.sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {tribunalStatusLabels[session.status]}</option>)}</select></label> : null}<form onSubmit={onCreate}><label>Titre de la nouvelle édition<input value={editionTitle} maxLength={120} onChange={(event) => onEditionTitle(event.target.value)} /></label><button type="submit" disabled={saving}>CRÉER LE BROUILLON</button></form>{action ? <button type="button" className={styles.dangerAction} disabled={saving} onClick={() => onSetStatus(action.next)}>{action.label}</button> : null}{context.session && context.session.status !== "draft" ? <button type="button" onClick={onPreview}>PRÉVISUALISER LES DÉGÂTS</button> : null}</section><section><h2>QUESTIONS</h2><ol className={styles.adminQuestions}>{context.questions.map((question) => <li key={question.id}><span><b>{question.position}</b>{question.prompt}</span><button type="button" onClick={() => onToggleQuestion(question)}>{question.isActive ? "DÉSACTIVER" : "RÉACTIVER"}</button></li>)}</ol></section><section><h2>MODÉRATION DES RÉPONSES LIBRES</h2>{context.moderation.length ? <ol className={styles.moderation}>{context.moderation.map((item) => <li key={item.id} className={item.isHidden ? styles.hiddenResponse : ""}><small>QUESTION {item.questionPosition} · {item.targetDisplayName ?? "SANS CIBLE"}</small><p>{item.freeText}</p><button type="button" onClick={() => onToggleResponse(item.id, !item.isHidden)}>{item.isHidden ? "RÉAFFICHER" : "MASQUER SANS SUPPRIMER"}</button></li>)}</ol> : <p>Aucune réponse libre à modérer.</p>}</section></div> : null}</aside>;
}
