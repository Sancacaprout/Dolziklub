"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Album } from "@/types/album";

type Tab = "archive" | "selection" | "quiz";
type SelectionRow = { id: string; position: number; members: string[]; is_locked: boolean };
type RemoteSelectionRow = { id: string; position: number; members: unknown; is_locked: boolean };

const tabs: Array<{ id: Tab; label: string; hint: string }> = [
  { id: "archive", label: "Archives", hint: "Toutes les écoutes, tirage par tirage" },
  { id: "selection", label: "Sélection", hint: "Les groupes proposés dans la feuille du club" },
  { id: "quiz", label: "Quiz +", hint: "Les goûts et curiosités des membres" },
];

const defaultSelections = [
  ["Toma", "Yuna", "Enzo"], ["Pep", "Dod", "Toma"], ["Motem", "Enzo", "Motem"], ["Chacha", "Toma", "Pep"], ["Dod", "Motem", "Yuna"], ["Yuna", "Pep", "Dod"], ["Enzo", "—", "—"],
].map((members, index) => ({ id: `fallback-${index + 1}`, position: index + 1, members, is_locked: false }));

const quizMembers = ["Toma", "Pep", "Motem", "Bono", "Dod", "Yuna", "Chacha", "Enzo", "Kougna", "Alain"];
const quizQuestions = [
  { question: "Le style de musique que j’écoute le + par défaut, c’est…", answers: ["Rap", "—", "Tout", "—", "Rock — puis n’importe quoi", "Pop — rap de la street bof", "Rock", "—", "Hip-hop — et le rock en 2e", "Instrumental"] },
  { question: "Ce que je n’aime VRAIMENT pas, c’est…", answers: ["Métal", "—", "Autotune bien dégueu", "—", "Classique", "Rap — rap de la street bof", "—", "—", "Il y a du bon dans tout", "Rap"] },
  { question: "Le style de musique que je suis curieux(se) d’écouter, c’est…", answers: ["Jazz", "Musique mongole", "—", "—", "Folk", "Expérimental", "Jazz", "—", "Autre — tout", "—"] },
  { question: "En général, l’élément qui m’attire en premier dans une musique, c’est…", answers: ["La mélodie — la prod intrigue, les paroles font rester", "L’ambiance — les émotions frr", "—", "—", "La mélodie — plus précisément les suites d’accords", "La mélodie", "La rythmique", "—", "L’ambiance", "L’ambiance — une musique avec une âme, les changements de tonalité qui surprennent"] },
];

const drawSizes = [10, 9, 17];

function value(input: string | null) { return input?.trim() || "—"; }
function readMembers(input: unknown) { return Array.isArray(input) ? [0, 1, 2].map((index) => typeof input[index] === "string" ? input[index] : "—") : ["—", "—", "—"]; }

function AlbumTable({ albums }: { albums: Album[] }) {
  let offset = 0;
  const groups = [...drawSizes, albums.length - drawSizes.reduce((total, size) => total + size, 0)].filter((size) => size > 0).map((size) => { const group = albums.slice(offset, offset + size); offset += size; return group; });
  return <div className="sheet-archive">{groups.map((group, index) => <section className="draw-section" key={`draw-${index + 1}`}><div className="draw-heading"><span className="eyebrow">TIRAGE {String(index + 1).padStart(2, "0")}</span><span>{group.length} album{group.length > 1 ? "s" : ""} classé{group.length > 1 ? "s" : ""}</span></div><div className="sheet-scroll"><table className="sheet-table"><thead><tr><th>Album · Artiste</th><th>Proposé par</th><th>Écouté par</th><th>Avis</th><th>Note</th><th>Best Track</th><th>Worst Track</th></tr></thead><tbody>{group.map((album) => <tr key={album.id}><td><Link className="sheet-album-link" href={`/albums/${album.slug}`}><b>{album.title}</b><span>{album.artist}</span></Link></td><td>{value(album.proposedBy)}</td><td>{value(album.listenedBy)}</td><td className="sheet-review">{value(album.shortReview)}</td><td>{album.status === "pending" ? <span className="sheet-pending">En attente</span> : album.rating === null ? "—" : <span className="rating">{album.rating.toFixed(1)} / 5</span>}</td><td>{value(album.bestTrack.title)}</td><td>{value(album.worstTrack.title)}</td></tr>)}</tbody></table></div></section>)}</div>;
}

function SelectionSheet({ rows, isAdmin, savingId, message, onMemberChange, onSave, onAdd, onToggleLock, onDelete }: { rows: SelectionRow[]; isAdmin: boolean; savingId: string | null; message: string; onMemberChange: (id: string, index: number, value: string) => void; onSave: (row: SelectionRow) => void; onAdd: () => void; onToggleLock: (row: SelectionRow) => void; onDelete: (row: SelectionRow) => void }) {
  return <section className="selection-sheet"><div className="sheet-note"><p className="eyebrow">FEUILLE SÉLECTION</p><p>{isAdmin ? "Mode édition administrateur : modifie les membres, enregistre, puis verrouille une sélection quand elle est confirmée." : "Les groupes notés dans le tableur d’origine, préservés ici dans un format plus lisible."}</p></div>{isAdmin && <div className="selection-admin-bar"><span className="eyebrow">ÉDITION ADMIN ACTIVE</span><button type="button" className="button" onClick={onAdd}>Ajouter une sélection</button></div>}{message && <p className="selection-message" role="status">{message}</p>}<div className="selection-grid">{rows.map((row) => <article className={`selection-card${row.is_locked ? " selection-card--locked" : ""}`} key={row.id}><div className="selection-card__heading"><span className="eyebrow">SÉLECTION {String(row.position).padStart(2, "0")}</span>{row.is_locked && <span className="selection-lock">Verrouillée</span>}</div>{isAdmin ? <div className="selection-editor">{row.members.map((member, memberIndex) => <label key={`${row.id}-${memberIndex}`}><b>{String(memberIndex + 1).padStart(2, "0")}</b><input value={member} maxLength={80} disabled={row.is_locked || savingId === row.id} onChange={(event) => onMemberChange(row.id, memberIndex, event.target.value)} aria-label={`Membre ${memberIndex + 1} de la sélection ${row.position}`} /></label>)}</div> : <ol>{row.members.map((member, memberIndex) => <li key={`${member}-${memberIndex}`}><b>{String(memberIndex + 1).padStart(2, "0")}</b>{member}</li>)}</ol>}{isAdmin && <div className="selection-card__actions"><button type="button" onClick={() => onSave(row)} disabled={row.is_locked || savingId === row.id}>{savingId === row.id ? "Enregistrement…" : "Enregistrer"}</button><button type="button" onClick={() => onToggleLock(row)} disabled={savingId === row.id}>{row.is_locked ? "Déverrouiller" : "Verrouiller"}</button><button type="button" className="selection-delete" onClick={() => onDelete(row)} disabled={row.is_locked || savingId === row.id}>Retirer</button></div>}</article>)}</div></section>;
}

function QuizSheet() { return <section className="quiz-sheet"><div className="quiz-intro"><p className="eyebrow">QUIZ +</p><h2>Pour mieux proposer,<br/><em>et mieux surprendre.</em></h2><p>Les réponses partagées par les membres pour guider les futures propositions dans le bac.</p></div><div className="quiz-scroll"><table className="quiz-table"><thead><tr><th>Question</th>{quizMembers.map((member) => <th key={member}>{member}</th>)}</tr></thead><tbody>{quizQuestions.map((entry) => <tr key={entry.question}><th>{entry.question}</th>{entry.answers.map((answer, index) => <td key={`${entry.question}-${quizMembers[index]}`} className={answer === "—" ? "is-empty" : ""}>{answer}</td>)}</tr>)}</tbody></table></div></section>; }

export function TableurBoard({ albums }: { albums: Album[] }) {
  const configured = isSupabaseConfigured();
  const [activeTab, setActiveTab] = useState<Tab>("archive");
  const [selectionRows, setSelectionRows] = useState<SelectionRow[]>(defaultSelections);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const active = tabs.find((tab) => tab.id === activeTab)!;

  const loadSelections = useCallback(async () => {
    if (!configured) return;
    const { data, error } = await getSupabaseBrowserClient().from("club_selection_rows").select("id, position, members, is_locked").order("position", { ascending: true });
    if (!error && data?.length) setSelectionRows((data as RemoteSelectionRow[]).map((row) => ({ id: row.id, position: row.position, members: readMembers(row.members), is_locked: row.is_locked })));
  }, [configured]);

  const syncAccess = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setUserId(user?.id ?? null);
    if (!user) { setIsAdmin(false); return; }
    const { data: profile } = await supabase.from("member_profiles").select("role").eq("id", user.id).maybeSingle();
    setIsAdmin(profile?.role === "admin");
  }, [configured]);

  useEffect(() => { const timer = setTimeout(() => { void loadSelections(); void syncAccess(); }, 0); return () => clearTimeout(timer); }, [loadSelections, syncAccess]);
  useEffect(() => {
    if (!configured) return;
    const { data: listener } = getSupabaseBrowserClient().auth.onAuthStateChange(() => void syncAccess());
    return () => listener.subscription.unsubscribe();
  }, [configured, syncAccess]);

  const updateMember = (id: string, index: number, input: string) => setSelectionRows((rows) => rows.map((row) => row.id === id ? { ...row, members: row.members.map((member, memberIndex) => memberIndex === index ? input : member) } : row));

  const saveRow = async (row: SelectionRow) => {
    if (!configured || !isAdmin || !userId || row.is_locked) return;
    const members = row.members.map((member) => member.trim() || "—");
    setSavingId(row.id); setMessage("");
    const { error } = await getSupabaseBrowserClient().from("club_selection_rows").update({ members, updated_by: userId }).eq("id", row.id);
    setSavingId(null);
    if (error) setMessage("La sélection n’a pas pu être enregistrée. Vérifie qu’elle est déverrouillée.");
    else { setMessage("Sélection enregistrée."); await loadSelections(); }
  };

  const addRow = async () => {
    if (!configured || !isAdmin || !userId) return;
    const position = Math.max(0, ...selectionRows.map((row) => row.position)) + 1;
    setSavingId("new"); setMessage("");
    const { error } = await getSupabaseBrowserClient().from("club_selection_rows").insert({ position, members: ["Nouveau membre", "Nouveau membre", "Nouveau membre"], updated_by: userId });
    setSavingId(null);
    if (error) setMessage("La nouvelle sélection n’a pas pu être créée.");
    else { setMessage("Nouvelle sélection ajoutée : renseigne les trois membres puis enregistre."); await loadSelections(); }
  };

  const toggleLock = async (row: SelectionRow) => {
    if (!configured || !isAdmin) return;
    setSavingId(row.id); setMessage("");
    const { error } = await getSupabaseBrowserClient().from("club_selection_rows").update({ is_locked: !row.is_locked }).eq("id", row.id);
    setSavingId(null);
    if (error) setMessage("Le verrou n’a pas pu être modifié.");
    else { setMessage(row.is_locked ? "Sélection déverrouillée." : "Sélection verrouillée."); await loadSelections(); }
  };

  const deleteRow = async (row: SelectionRow) => {
    if (!configured || !isAdmin || row.is_locked) return;
    setSavingId(row.id); setMessage("");
    const { error } = await getSupabaseBrowserClient().from("club_selection_rows").delete().eq("id", row.id);
    setSavingId(null);
    if (error) setMessage("La sélection n’a pas pu être retirée.");
    else { setMessage("Sélection retirée."); await loadSelections(); }
  };

  return <section className="tableur-board" aria-label="Tableur du DOL ZIKLUB"><div className="sheet-tabs" role="tablist" aria-label="Feuilles du tableur">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" id={`tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls={`sheet-${tab.id}`} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div><div className="sheet-meta"><span className="eyebrow">{active.label}</span><span>{active.hint}</span></div><div role="tabpanel" id={`sheet-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>{activeTab === "archive" && <AlbumTable albums={albums} />}{activeTab === "selection" && <SelectionSheet rows={selectionRows} isAdmin={isAdmin} savingId={savingId} message={message} onMemberChange={updateMember} onSave={(row) => void saveRow(row)} onAdd={() => void addRow()} onToggleLock={(row) => void toggleLock(row)} onDelete={(row) => void deleteRow(row)} />}{activeTab === "quiz" && <QuizSheet />}</div></section>;
}
