import type { Metadata } from "next";
import { UpdatesBoard } from "@/components/updates-board";
import { siteUpdates } from "@/data/site-updates";

export const metadata: Metadata = {
  title: "Mises à jour — DOL ZIKLUB",
  description: "Les nouvelles fonctionnalités, corrections et améliorations de DOL ZIKLUB.",
};

export default function UpdatesPage() {
  return (
    <main className="page updates-page">
      <header className="updates-page__masthead">
        <p className="eyebrow">JOURNAL DU CLUB</p>
        <h1>LES MISES<br /><em>À JOUR</em></h1>
        <p className="page-lede">Tout ce qui change dans DOL ZIKLUB, sans le blabla inutile.</p>
        <aside>
          <b>{siteUpdates.length}</b>
          <span>versions consignées</span>
        </aside>
      </header>
      <UpdatesBoard updates={siteUpdates} />
    </main>
  );
}
