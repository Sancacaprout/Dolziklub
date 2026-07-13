import type { Metadata } from "next";
import { AlbumExplorer } from "@/components/album-explorer";
import { albums } from "@/data/albums";

export const metadata: Metadata = { title: "Albums | DOL ZIKLUB" };

export default function AlbumsPage() {
  return <main className="page"><p className="eyebrow">LA DISCOTHÈQUE</p><h1>Les albums<br/><em>qui traînent ici.</em></h1><p className="page-lede">{albums.length} albums retrouvés, avec les propositions, écoutes, avis et notes qui ont été archivés. Recherche locale, affichage grille ou liste.</p><AlbumExplorer albums={albums} /></main>;
}
