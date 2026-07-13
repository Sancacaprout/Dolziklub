"use client";

import { useMemo, useState } from "react";
import { AlbumCard } from "@/components/album-card";
import { getMemberDisplayName, members } from "@/data/members";
import type { Album } from "@/types/album";

function GridIcon() {
  return <svg className="view-toggle__icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}

function ListIcon() {
  return <svg className="view-toggle__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14" /></svg>;
}

const memberName = (value: string | null) => getMemberDisplayName(value).toLocaleLowerCase("fr");

export function AlbumExplorer({ albums }: { albums: Album[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"latest" | "oldest" | "pending" | "title" | "rating" | "proposed" | "listened">("latest");
  const [member, setMember] = useState("");
  const results = useMemo(() => albums
    .filter((album) => `${album.title} ${album.artist} ${album.genres.join(" ")}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")))
    .filter((album) => !member || [album.proposedBy, album.listenedBy].some((name) => memberName(name) === member))
    .sort((a, b) => {
      const archivePosition = (album: Album) => Number(album.id.replace("archive-", ""));
      if (sort === "latest") return archivePosition(b) - archivePosition(a);
      if (sort === "oldest") return archivePosition(a) - archivePosition(b);
      if (sort === "pending") return Number(a.status !== "pending") - Number(b.status !== "pending") || archivePosition(b) - archivePosition(a);
      if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
      if (sort === "proposed") return memberName(a.proposedBy).localeCompare(memberName(b.proposedBy), "fr") || a.title.localeCompare(b.title, "fr");
      if (sort === "listened") return memberName(a.listenedBy).localeCompare(memberName(b.listenedBy), "fr") || a.title.localeCompare(b.title, "fr");
      return a.title.localeCompare(b.title, "fr");
    }), [albums, member, query, sort]);

  return <><div className="filter-bar"><label>Rechercher<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Album, artiste, genre…" /></label><label>Tri<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="latest">Plus récent</option><option value="oldest">Plus ancien</option><option value="pending">En attente d’écoute</option><option value="title">Alphabétique</option><option value="rating">Note</option><option value="proposed">Proposé par</option><option value="listened">Écouté par</option></select></label><label>Membre<select value={member} onChange={(event) => setMember(event.target.value)}><option value="">Tous les membres</option>{members.map((clubMember) => <option key={clubMember.slug} value={clubMember.displayName.toLocaleLowerCase("fr")}>{clubMember.displayName}</option>)}</select></label><div className="view-toggle"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-pressed={view === "grid"}><GridIcon /><span>Grille</span></button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-pressed={view === "list"}><ListIcon /><span>Liste</span></button></div></div><p className="result-count">{results.length} archive{results.length > 1 ? "s" : ""} retrouvée{results.length > 1 ? "s" : ""}</p>{results.length ? <div className={view === "grid" ? "album-grid" : "album-list"}>{results.map((album) => <AlbumCard key={album.id} album={album} list={view === "list"} />)}</div> : <div className="empty-state"><b>Aucun disque dans ce bac.</b><p>Essaie un autre titre, un artiste ou un membre.</p><button onClick={() => { setQuery(""); setMember(""); }}>Réinitialiser</button></div>}</>;
}
