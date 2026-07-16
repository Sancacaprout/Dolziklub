import type { Metadata } from "next";
import { AlbumExplorer } from "@/components/album-explorer";
import { albums } from "@/data/albums";
import { getSynchronizedAlbums } from "@/lib/live-albums";

export const metadata: Metadata = { title: "Albums | DOL ZIKLUB" };
export const dynamic = "force-dynamic";

export default async function AlbumsPage() {
  const synchronizedAlbums = await getSynchronizedAlbums().catch(() => albums);
  return <main className="page"><p className="eyebrow">LA DISCOTHÈQUE</p><h1>Les albums<br/><em>qui traînent ici.</em></h1><p className="page-lede">{synchronizedAlbums.length} albums retrouvés, avec les propositions, écoutes, avis et notes qui ont été archivés. Recherche locale, affichage grille ou liste.</p><AlbumExplorer albums={synchronizedAlbums} /></main>;
}
