"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { members } from "@/data/members";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Album } from "@/types/album";

type Tab = "archive" | "selection" | "quiz";
type SelectionRow = { id: string; position: number; members: string[]; is_locked: boolean };
type RemoteSelectionRow = { id: string; position: number; members: unknown; is_locked: boolean };
type ReviewRecord = {
  album_id: string;
  review: string;
  rating: number;
  best_track: string | null;
  worst_track: string | null;
  updated_at: string;
};
type SignedMember = { id: string; username: string; displayName: string };
type ReviewPayload = { albumId: string; review: string; rating: number; bestTrack: string; worstTrack: string };

const tabs: Array<{ id: Tab; label: string; hint: string }> = [
  { id: "archive", label: "Tirages", hint: "Toutes les écoutes, tirage par tirage" },
  { id: "selection", label: "Sélection", hint: "Tes écoutes à rendre et les nouveaux tirages" },
  { id: "quiz", label: "Quiz +", hint: "Les goûts et curiosités des membres" },
];

const rosterNames = members.map((member) => member.displayName);
const emptyMembers = ["—", "—", "—"];
const defaultSelections: SelectionRow[] = [
  ["Toma", "Yuna", "Enzo"],
  ["Pep", "Dod", "Toma"],
  ["Motem", "Enzo", "Motem"],
  ["Chacha", "Toma", "Pep"],
  ["Dod", "Motem", "Yuna"],
  ["Yuna", "Pep", "Dod"],
  ["Enzo", "—", "—"],
].map((members, index) => ({ id: `fallback-${index + 1}`, position: index + 1, members, is_locked: false }));

const quizMembers = ["Toma", "Pep", "Motem", "Bono", "Dod", "Yuna", "Chacha", "Enzo", "Kougna", "Alain"];
const quizQuestions = [
  { question: "Le style de musique que j’écoute le + par défaut, c’est…", answers: ["Rap", "—", "Tout", "—", "Rock — puis n’importe quoi", "Pop — rap de la street bof", "Rock", "—", "Hip-hop — et le rock en 2e", "Instrumental"] },
  { question: "Ce que je n’aime VRAIMENT pas, c’est…", answers: ["Métal", "—", "Autotune bien dégueu", "—", "Classique", "Rap — rap de la street bof", "—", "—", "Il y a du bon dans tout", "Rap"] },
  { question: "Le style de musique que je suis curieux(se) d’écouter, c’est…", answers: ["Jazz", "Musique mongole", "—", "—", "Folk", "Expérimental", "Jazz", "—", "Autre — tout", "—"] },
  { question: "En général, l’élément qui m’attire en premier dans une musique, c’est…", answers: ["La mélodie — la prod intrigue, les paroles font rester", "L’ambiance — les émotions frr", "—", "—", "La mélodie — plus précisément les suites d’accords", "La mélodie", "La rythmique", "—", "L’ambiance", "L’ambiance — une musique avec une âme, les changements de tonalité qui surprennent"] },
];

const drawSizes = [10, 9, 17];
const ratingChoices = Array.from({ length: 11 }, (_, index) => index / 2);

function value(input: string | null) {
  return input?.trim() || "—";
}

function memberName(input: string | null) {
  const name = value(input);
  return name === "—" ? name : `${name.slice(0, 1).toLocaleUpperCase()}${name.slice(1)}`;
}

function readMembers(input: unknown) {
  return Array.isArray(input)
    ? [0, 1, 2].map((index) => (typeof input[index] === "string" ? input[index] : "—"))
    : emptyMembers;
}

function normalise(input: string | null | undefined) {
  return input?.trim().toLocaleLowerCase() ?? "";
}

function isAssignedTo(album: Album, member: SignedMember) {
  const listener = normalise(album.listenedBy);
  if (!listener) return false;
  const matchedRosterMember = members.find((entry) => [entry.displayName, entry.username, entry.slug].some((candidate) => normalise(candidate) === listener));
  const aliases = [member.username, member.displayName, matchedRosterMember?.displayName, matchedRosterMember?.username, matchedRosterMember?.slug].map(normalise);
  return aliases.includes(listener);
}

function TrackLink({ album, kind }: { album: Album; kind: "bestTrack" | "worstTrack" }) {
  const track = album[kind];
  if (!track.title) return <span className="sheet-track-empty">—</span>;
  const url = track.url ?? `https://music.youtube.com/search?q=${encodeURIComponent(`${album.artist} ${track.title}`)}`;
  return <a className={`sheet-track-link sheet-track-link--${kind === "bestTrack" ? "best" : "worst"}`} href={url} target="_blank" rel="noreferrer" aria-label={`Écouter ${track.title} sur YouTube Music`}>{track.title}<span aria-hidden="true">↗</span></a>;
}

function AlbumTable({ albums }: { albums: Album[] }) {
  let offset = 0;
  const groups = [...drawSizes, albums.length - drawSizes.reduce((total, size) => total + size, 0)]
    .filter((size) => size > 0)
    .map((size) => {
      const group = albums.slice(offset, offset + size);
      offset += size;
      return group;
    });

  return <div className="sheet-archive">{groups.map((group, index) => <section className="draw-section" key={`draw-${index + 1}`}><div className="draw-heading"><span className="eyebrow">TIRAGE {String(index + 1).padStart(2, "0")}</span><span>{group.length} album{group.length > 1 ? "s" : ""} classés</span></div><div className="sheet-scroll"><table className="sheet-table"><thead><tr><th>Album · Artiste</th><th>Proposé par</th><th>Écouté par</th><th>Avis</th><th>Note</th><th>Best Track</th><th>Worst Track</th></tr></thead><tbody>{group.map((album) => <tr key={album.id}><td><Link className="sheet-album-link" href={`/albums/${album.slug}`}><b>{album.title}</b><span>{album.artist}</span></Link></td><td><span className="sheet-member">{memberName(album.proposedBy)}</span></td><td><span className="sheet-member">{memberName(album.listenedBy)}</span></td><td className="sheet-review">{value(album.shortReview)}</td><td>{album.status === "pending" ? <span className="sheet-pending">En attente</span> : album.rating === null ? "—" : <span className="rating sheet-rating">{album.rating.toFixed(1)} / 5</span>}</td><td><TrackLink album={album} kind="bestTrack" /></td><td><TrackLink album={album} kind="worstTrack" /></td></tr>)}</tbody></table></div></section>)}</div>;
}

function MemberSelect({ value: selected, onChange, disabled, label }: { value: string; onChange: (value: string) => void; disabled?: boolean; label: string }) {
  return <select value={selected} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-label={label}>{["—", ...rosterNames].map((name) => <option value={name} key={name}>{name}</option>)}</select>;
}

function DrawSheet({ rows, isAdmin, savingId, message, draftMembers, onDraftChange, onMemberChange, onSave, onCreate, onToggleLock, onDelete }: {
  rows: SelectionRow[];
  isAdmin: boolean;
  savingId: string | null;
  message: string;
  draftMembers: string[];
  onDraftChange: (index: number, value: string) => void;
  onMemberChange: (id: string, index: number, value: string) => void;
  onSave: (row: SelectionRow) => void;
  onCreate: () => void;
  onToggleLock: (row: SelectionRow) => void;
  onDelete: (row: SelectionRow) => void;
}) {
  return <section className="draw-sheet"><div className="sheet-note"><p className="eyebrow">TIRAGES DU CLUB</p><p>{isAdmin ? "Compose un tirage, choisis les membres dans chaque case, puis verrouille-le quand la composition est confirmée." : "Les tirages préparés pour le club. Connecte-toi pour retrouver les albums qui te sont attribués juste au-dessus."}</p></div>{isAdmin && <div className="draw-creator"><div><span className="eyebrow">NOUVEAU TIRAGE</span><h3>Créer un nouveau tirage</h3><p>Choisis les trois pseudos avant de l’ajouter à la feuille.</p></div><div className="draw-creator__fields">{draftMembers.map((member, index) => <label key={`draft-${index}`}><span>Case {String(index + 1).padStart(2, "0")}</span><MemberSelect value={member} disabled={savingId === "new"} label={`Membre ${index + 1} du nouveau tirage`} onChange={(value) => onDraftChange(index, value)} /></label>)}</div><button type="button" className="button" disabled={savingId === "new"} onClick={onCreate}>{savingId === "new" ? "Création…" : "Créer ce tirage"}</button></div>}{message && <p className="selection-message" role="status">{message}</p>}<div className="selection-grid">{rows.map((row) => <article className={`selection-card${row.is_locked ? " selection-card--locked" : ""}`} key={row.id}><div className="selection-card__heading"><span className="eyebrow">TIRAGE {String(row.position).padStart(2, "0")}</span>{row.is_locked && <span className="selection-lock">Verrouillé</span>}</div>{isAdmin ? <div className="selection-editor">{row.members.map((member, memberIndex) => <label key={`${row.id}-${memberIndex}`}><b>{String(memberIndex + 1).padStart(2, "0")}</b><MemberSelect value={member} disabled={row.is_locked || savingId === row.id} label={`Membre ${memberIndex + 1} du tirage ${row.position}`} onChange={(value) => onMemberChange(row.id, memberIndex, value)} /></label>)}</div> : <ol>{row.members.map((member, memberIndex) => <li key={`${member}-${memberIndex}`}><b>{String(memberIndex + 1).padStart(2, "0")}</b>{member}</li>)}</ol>}{isAdmin && <div className="selection-card__actions"><button type="button" onClick={() => onSave(row)} disabled={row.is_locked || savingId === row.id}>{savingId === row.id ? "Enregistrement…" : "Enregistrer"}</button><button type="button" onClick={() => onToggleLock(row)} disabled={savingId === row.id}>{row.is_locked ? "Déverrouiller" : "Verrouiller"}</button><button type="button" className="selection-delete" onClick={() => onDelete(row)} disabled={row.is_locked || savingId === row.id}>Retirer</button></div>}</article>)}</div></section>;
}

function ReviewCard({ album, existing, saving, onSave }: { album: Album; existing?: ReviewRecord; saving: boolean; onSave: (payload: ReviewPayload) => void }) {
  const [review, setReview] = useState(existing?.review ?? "");
  const [rating, setRating] = useState(String(existing?.rating ?? ""));
  const [bestTrack, setBestTrack] = useState(existing?.best_track ?? "");
  const [worstTrack, setWorstTrack] = useState(existing?.worst_track ?? "");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({ albumId: album.id, review, rating: Number(rating), bestTrack, worstTrack });
  };

  return <article className="review-card"><div className="review-card__album"><span className="eyebrow">{existing ? "VERDICT ENREGISTRÉ" : "À RENDRE"}</span><h3>{album.title}</h3><p>{album.artist}</p><Link href={`/albums/${album.slug}`}>Voir la fiche de l’album →</Link></div><form className="review-form" onSubmit={submit}><label><span>Ton avis</span><textarea required maxLength={2000} value={review} onChange={(event) => setReview(event.target.value)} placeholder="Ton verdict, sans filtre." /></label><label><span>Ta note</span><select required value={rating} onChange={(event) => setRating(event.target.value)}><option value="" disabled>Choisir une note</option>{ratingChoices.map((choice) => <option key={choice} value={choice}>{choice.toFixed(1)} / 5</option>)}</select></label><div className="review-form__tracks"><label><span>Best track</span><input maxLength={160} value={bestTrack} onChange={(event) => setBestTrack(event.target.value)} placeholder="Ton meilleur morceau" /></label><label><span>Worst track</span><input maxLength={160} value={worstTrack} onChange={(event) => setWorstTrack(event.target.value)} placeholder="Le morceau le moins convaincant" /></label></div><button type="submit" className="button" disabled={saving}>{saving ? "Enregistrement…" : existing ? "Mettre à jour mon verdict" : "Enregistrer mon verdict"}</button></form></article>;
}

function ReviewWorkspace({ albums, member, reviews, savingAlbumId, onSave }: { albums: Album[]; member: SignedMember | null; reviews: ReviewRecord[]; savingAlbumId: string | null; onSave: (payload: ReviewPayload) => void }) {
  const assigned = useMemo(() => member ? albums.filter((album) => album.status === "pending" && isAssignedTo(album, member)) : [], [albums, member]);
  const reviewByAlbum = useMemo(() => new Map(reviews.map((review) => [review.album_id, review])), [reviews]);

  return <section className="review-workspace"><div className="review-workspace__heading"><div><p className="eyebrow">MA SÉLECTION ACTUELLE</p><h2>Mes écoutes <em>à rendre.</em></h2><p>{member ? `Bonjour ${member.displayName} : ajoute ici ton avis, ta note et tes deux tracks pour chaque album qui t’est confié.` : "Connecte-toi pour retrouver tes albums attribués et rendre tes verdicts."}</p></div>{member && <span className="review-counter">{assigned.length} album{assigned.length > 1 ? "s" : ""} attribué{assigned.length > 1 ? "s" : ""}</span>}</div>{!member ? <div className="review-workspace__empty"><p>La connexion est nécessaire pour enregistrer un verdict personnel.</p><Link className="button" href="/connexion">Connexion</Link></div> : assigned.length === 0 ? <div className="review-workspace__empty"><p>Rien à rendre pour l’instant. Les prochains albums qui te seront attribués apparaîtront ici.</p></div> : <div className="review-queue">{assigned.map((album) => <ReviewCard key={album.id} album={album} existing={reviewByAlbum.get(album.id)} saving={savingAlbumId === album.id} onSave={onSave} />)}</div>}</section>;
}

function QuizSheet() {
  return <section className="quiz-sheet"><div className="quiz-intro"><p className="eyebrow">QUIZ +</p><h2>Pour mieux proposer,<br /><em>et mieux surprendre.</em></h2><p>Les réponses partagées par les membres pour guider les futures propositions dans le bac.</p></div><div className="quiz-scroll"><table className="quiz-table"><thead><tr><th>Question</th>{quizMembers.map((member) => <th key={member}>{member}</th>)}</tr></thead><tbody>{quizQuestions.map((entry) => <tr key={entry.question}><th>{entry.question}</th>{entry.answers.map((answer, index) => <td key={`${entry.question}-${quizMembers[index]}`} className={answer === "—" ? "is-empty" : ""}>{answer}</td>)}</tr>)}</tbody></table></div></section>;
}

export function TableurBoard({ albums }: { albums: Album[] }) {
  const configured = isSupabaseConfigured();
  const [activeTab, setActiveTab] = useState<Tab>("archive");
  const [selectionRows, setSelectionRows] = useState<SelectionRow[]>(defaultSelections);
  const [draftMembers, setDraftMembers] = useState<string[]>(emptyMembers);
  const [isAdmin, setIsAdmin] = useState(false);
  const [member, setMember] = useState<SignedMember | null>(null);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAlbumId, setSavingAlbumId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const active = tabs.find((tab) => tab.id === activeTab)!;

  const loadSelections = useCallback(async () => {
    if (!configured) return;
    const { data, error } = await getSupabaseBrowserClient().from("club_selection_rows").select("id, position, members, is_locked").order("position", { ascending: true });
    if (!error && data?.length) setSelectionRows((data as RemoteSelectionRow[]).map((row) => ({ id: row.id, position: row.position, members: readMembers(row.members), is_locked: row.is_locked })));
  }, [configured]);

  const loadReviews = useCallback(async () => {
    if (!configured) return;
    const { data, error } = await getSupabaseBrowserClient().from("member_album_reviews").select("album_id, review, rating, best_track, worst_track, updated_at").order("updated_at", { ascending: false });
    if (!error) setReviews((data ?? []) as ReviewRecord[]);
  }, [configured]);

  const syncAccess = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setMember(null);
      setIsAdmin(false);
      setReviews([]);
      return;
    }
    const username = typeof user.app_metadata.username === "string" ? user.app_metadata.username : user.email?.split("@")[0] ?? "membre";
    const displayName = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : members.find((entry) => entry.username === username)?.displayName ?? username;
    setMember({ id: user.id, username, displayName });
    const { data: profile } = await supabase.from("member_profiles").select("role").eq("id", user.id).maybeSingle();
    setIsAdmin(profile?.role === "admin");
    await loadReviews();
  }, [configured, loadReviews]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadSelections(); void syncAccess(); }, 0);
    return () => clearTimeout(timer);
  }, [loadSelections, syncAccess]);

  useEffect(() => {
    if (!configured) return;
    const { data: listener } = getSupabaseBrowserClient().auth.onAuthStateChange(() => void syncAccess());
    return () => listener.subscription.unsubscribe();
  }, [configured, syncAccess]);

  const updateMember = (id: string, index: number, input: string) => setSelectionRows((rows) => rows.map((row) => row.id === id ? { ...row, members: row.members.map((current, memberIndex) => memberIndex === index ? input : current) } : row));
  const updateDraftMember = (index: number, input: string) => setDraftMembers((current) => current.map((member, memberIndex) => memberIndex === index ? input : member));

  const saveRow = async (row: SelectionRow) => {
    if (!configured || !isAdmin || !member || row.is_locked) return;
    setSavingId(row.id);
    setMessage("");
    const { error } = await getSupabaseBrowserClient().from("club_selection_rows").update({ members: row.members, updated_by: member.id }).eq("id", row.id);
    setSavingId(null);
    if (error) setMessage("Le tirage n’a pas pu être enregistré. Vérifie qu’il est déverrouillé.");
    else {
      setMessage("Tirage enregistré.");
      await loadSelections();
    }
  };

  const addRow = async () => {
    if (!configured || !isAdmin || !member) return;
    const position = Math.max(0, ...selectionRows.map((row) => row.position)) + 1;
    setSavingId("new");
    setMessage("");
    const { error } = await getSupabaseBrowserClient().from("club_selection_rows").insert({ position, members: draftMembers, updated_by: member.id });
    setSavingId(null);
    if (error) setMessage("Le nouveau tirage n’a pas pu être créé.");
    else {
      setDraftMembers(emptyMembers);
      setMessage("Nouveau tirage créé.");
      await loadSelections();
    }
  };

  const toggleLock = async (row: SelectionRow) => {
    if (!configured || !isAdmin) return;
    setSavingId(row.id);
    setMessage("");
    const { error } = await getSupabaseBrowserClient().from("club_selection_rows").update({ is_locked: !row.is_locked }).eq("id", row.id);
    setSavingId(null);
    if (error) setMessage("Le verrou n’a pas pu être modifié.");
    else {
      setMessage(row.is_locked ? "Tirage déverrouillé." : "Tirage verrouillé.");
      await loadSelections();
    }
  };

  const deleteRow = async (row: SelectionRow) => {
    if (!configured || !isAdmin || row.is_locked) return;
    setSavingId(row.id);
    setMessage("");
    const { error } = await getSupabaseBrowserClient().from("club_selection_rows").delete().eq("id", row.id);
    setSavingId(null);
    if (error) setMessage("Le tirage n’a pas pu être retiré.");
    else {
      setMessage("Tirage retiré.");
      await loadSelections();
    }
  };

  const saveReview = async (payload: ReviewPayload) => {
    if (!configured || !member) return;
    if (!payload.review.trim() || !Number.isFinite(payload.rating) || payload.rating < 0 || payload.rating > 5) {
      setMessage("Ajoute un avis et une note comprise entre 0 et 5.");
      return;
    }
    setSavingAlbumId(payload.albumId);
    setMessage("");
    const { error } = await getSupabaseBrowserClient().from("member_album_reviews").upsert({ album_id: payload.albumId, member_id: member.id, review: payload.review.trim(), rating: payload.rating, best_track: payload.bestTrack.trim() || null, worst_track: payload.worstTrack.trim() || null }, { onConflict: "album_id,member_id" });
    setSavingAlbumId(null);
    if (error) setMessage("Ton verdict n’a pas pu être enregistré. Réessaie dans un instant.");
    else {
      setMessage("Ton verdict a été enregistré.");
      await loadReviews();
    }
  };

  return <section className="tableur-board" aria-label="Tableur du DOL ZIKLUB"><div className="sheet-tabs" role="tablist" aria-label="Feuilles du tableur">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" id={`tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls={`sheet-${tab.id}`} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div><div className="sheet-meta"><span className="eyebrow">{active.label}</span><span>{active.hint}</span></div><div role="tabpanel" id={`sheet-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>{activeTab === "archive" && <AlbumTable albums={albums} />}{activeTab === "selection" && <><ReviewWorkspace albums={albums} member={member} reviews={reviews} savingAlbumId={savingAlbumId} onSave={(payload) => void saveReview(payload)} /><DrawSheet rows={selectionRows} isAdmin={isAdmin} savingId={savingId} message={message} draftMembers={draftMembers} onDraftChange={updateDraftMember} onMemberChange={updateMember} onSave={(row) => void saveRow(row)} onCreate={() => void addRow()} onToggleLock={(row) => void toggleLock(row)} onDelete={(row) => void deleteRow(row)} /></>}{activeTab === "quiz" && <QuizSheet />}</div></section>;
}
