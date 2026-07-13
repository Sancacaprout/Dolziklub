import type { Metadata } from "next";
import { TableurBoard } from "@/components/tableur-board";
import { albums } from "@/data/albums";

export const metadata: Metadata = { title: "Tableur | DOL ZIKLUB" };

export default function TableurPage() {
  return <main className="page tableur-page"><p className="eyebrow">LES FEUILLES DU CLUB</p><h1>Le tableur,<br/><em>sans quitter le bac.</em></h1><p className="page-lede">L’archive complète du DOL ZIKLUB, les sélections et le quiz du club : chaque feuille a été remise en forme pour être plus simple à parcourir.</p><TableurBoard albums={albums} /></main>;
}
