"use client";

import Link from "next/link";
import { useState } from "react";
import type { Album } from "@/types/album";

type Tab = "archive" | "selection" | "quiz";

const tabs: Array<{ id: Tab; label: string; hint: string }> = [
  { id: "archive", label: "Archives", hint: "Toutes les écoutes, tirage par tirage" },
  { id: "selection", label: "Sélection", hint: "Les groupes proposés dans la feuille du club" },
  { id: "quiz", label: "Quiz +", hint: "Les goûts et curiosités des membres" },
];

const selectionRows = [
  ["Toma", "Yuna", "Enzo"],
  ["Pep", "Dod", "Toma"],
  ["Motem", "Enzo", "Motem"],
  ["Chacha", "Toma", "Pep"],
  ["Dod", "Motem", "Yuna"],
  ["Yuna", "Pep", "Dod"],
  ["Enzo", "—", "—"],
];

const quizMembers = ["Toma", "Pep", "Motem", "Bono", "Dod", "Yuna", "Chacha", "Enzo", "Kougna", "Alain"];
const quizQuestions = [
  {
    question: "Le style de musique que j’écoute le + par défaut, c’est…",
    answers: ["Rap", "—", "Tout", "—", "Rock — puis n’importe quoi", "Pop — rap de la street bof", "Rock", "—", "Hip-hop — et le rock en 2e", "Instrumental"],
  },
  {
    question: "Ce que je n’aime VRAIMENT pas, c’est…",
    answers: ["Métal", "—", "Autotune bien dégueu", "—", "Classique", "Rap — rap de la street bof", "—", "—", "Il y a du bon dans tout", "Rap"],
  },
  {
    question: "Le style de musique que je suis curieux(se) d’écouter, c’est…",
    answers: ["Jazz", "Musique mongole", "—", "—", "Folk", "Expérimental", "Jazz", "—", "Autre — tout", "—"],
  },
  {
    question: "En général, l’élément qui m’attire en premier dans une musique, c’est…",
    answers: ["La mélodie — la prod intrigue, les paroles font rester", "L’ambiance — les émotions frr", "—", "—", "La mélodie — plus précisément les suites d’accords", "La mélodie", "La rythmique", "—", "L’ambiance", "L’ambiance — une musique avec une âme, les changements de tonalité qui surprennent"],
  },
];

const drawSizes = [10, 9, 17];

function value(input: string | null) {
  return input?.trim() || "—";
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

  return <div className="sheet-archive">{groups.map((group, index) => <section className="draw-section" key={`draw-${index + 1}`}><div className="draw-heading"><span className="eyebrow">TIRAGE {String(index + 1).padStart(2, "0")}</span><span>{group.length} album{group.length > 1 ? "s" : ""} classé{group.length > 1 ? "s" : ""}</span></div><div className="sheet-scroll"><table className="sheet-table"><thead><tr><th>Album · Artiste</th><th>Proposé par</th><th>Écouté par</th><th>Avis</th><th>Note</th><th>Best Track</th><th>Worst Track</th></tr></thead><tbody>{group.map((album) => <tr key={album.id}><td><Link className="sheet-album-link" href={`/albums/${album.slug}`}><b>{album.title}</b><span>{album.artist}</span></Link></td><td>{value(album.proposedBy)}</td><td>{value(album.listenedBy)}</td><td className="sheet-review">{value(album.shortReview)}</td><td>{album.status === "pending" ? <span className="sheet-pending">En attente</span> : album.rating === null ? "—" : <span className="rating">{album.rating.toFixed(1)} / 5</span>}</td><td>{value(album.bestTrack.title)}</td><td>{value(album.worstTrack.title)}</td></tr>)}</tbody></table></div></section>)}</div>;
}

function SelectionSheet() {
  return <section className="selection-sheet"><div className="sheet-note"><p className="eyebrow">FEUILLE SÉLECTION</p><p>Les groupes notés dans le tableur d’origine, préservés ici dans un format plus lisible.</p></div><div className="selection-grid">{selectionRows.map((members, index) => <article className="selection-card" key={`selection-${index + 1}`}><span className="eyebrow">SÉLECTION {String(index + 1).padStart(2, "0")}</span><ol>{members.map((member, memberIndex) => <li key={`${member}-${memberIndex}`}><b>{String(memberIndex + 1).padStart(2, "0")}</b>{member}</li>)}</ol></article>)}</div></section>;
}

function QuizSheet() {
  return <section className="quiz-sheet"><div className="quiz-intro"><p className="eyebrow">QUIZ +</p><h2>Pour mieux proposer,<br/><em>et mieux surprendre.</em></h2><p>Les réponses partagées par les membres pour guider les futures propositions dans le bac.</p></div><div className="quiz-scroll"><table className="quiz-table"><thead><tr><th>Question</th>{quizMembers.map((member) => <th key={member}>{member}</th>)}</tr></thead><tbody>{quizQuestions.map((entry) => <tr key={entry.question}><th>{entry.question}</th>{entry.answers.map((answer, index) => <td key={`${entry.question}-${quizMembers[index]}`} className={answer === "—" ? "is-empty" : ""}>{answer}</td>)}</tr>)}</tbody></table></div></section>;
}

export function TableurBoard({ albums }: { albums: Album[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("archive");
  const active = tabs.find((tab) => tab.id === activeTab)!;

  return <section className="tableur-board" aria-label="Tableur du DOL ZIKLUB"><div className="sheet-tabs" role="tablist" aria-label="Feuilles du tableur">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" id={`tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls={`sheet-${tab.id}`} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div><div className="sheet-meta"><span className="eyebrow">{active.label}</span><span>{active.hint}</span></div><div role="tabpanel" id={`sheet-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>{activeTab === "archive" && <AlbumTable albums={albums} />}{activeTab === "selection" && <SelectionSheet />}{activeTab === "quiz" && <QuizSheet />}</div></section>;
}
