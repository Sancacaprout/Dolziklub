"use client";
import { useMemo, useState } from "react";
import { AlbumCard } from "@/components/album-card";
import type { Album } from "@/types/album";

export function AlbumExplorer({ albums }: { albums: Album[] }) {
  const [query, setQuery] = useState(""); const [view, setView] = useState<"grid" | "list">("grid"); const [sort, setSort] = useState<"title" | "rating">("title");
  const results = useMemo(() => albums.filter((album) => `${album.title} ${album.artist} ${album.genres.join(" ")}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))).sort((a, b) => sort === "rating" ? (b.rating ?? -1) - (a.rating ?? -1) : a.title.localeCompare(b.title, "fr")), [albums, query, sort]);
  return <><div className="filter-bar"><label>Rechercher<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Album, artiste, genre…" /></label><label>Tri<select value={sort} onChange={(event) => setSort(event.target.value as "title" | "rating")}><option value="title">Alphabétique</option><option value="rating">Note</option></select></label><div className="view-toggle"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Grille</button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Liste</button></div></div><p className="result-count">{results.length} archive{results.length > 1 ? "s" : ""} retrouvée{results.length > 1 ? "s" : ""}</p>{results.length ? <div className={view === "grid" ? "album-grid" : "album-list"}>{results.map((album) => <AlbumCard key={album.id} album={album} list={view === "list"} />)}</div> : <div className="empty-state"><b>Aucun disque dans ce bac.</b><p>Essaie un autre titre ou artiste.</p><button onClick={() => setQuery("")}>Réinitialiser</button></div>}</>;
}
