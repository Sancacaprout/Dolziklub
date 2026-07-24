import type { Metadata } from "next";
import { UpdatesBoard } from "@/components/updates-board";
import { getSiteUpdates } from "@/lib/site-updates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mises à jour — DOL ZIKLUB",
  description: "Les nouvelles fonctionnalités, corrections et améliorations de DOL ZIKLUB.",
};

export default async function UpdatesPage() {
  const siteUpdates = await getSiteUpdates();

  return (
    <main className="page updates-page">
      <header className="updates-page__masthead">
        <p className="eyebrow">JOURNAL DU CLUB</p>
        <h1>LES MISES<br /><em>À JOUR</em></h1>
        <p className="page-lede">Tout ce qui change dans DOL ZIKLUB, sans le blabla inutile.</p>
        <span className="updates-page__vinyl" aria-hidden="true"><i /></span>
        <aside>
          <b>{siteUpdates.length}</b>
          <span>versions consignées</span>
        </aside>
      </header>
      <UpdatesBoard updates={siteUpdates} />
    </main>
  );
}