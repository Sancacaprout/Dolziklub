import { IdeasBoard } from "@/components/ideas-board";

export const metadata = { title: "Boîte à idées — DOL ZIKLUB" };

export default function IdeasPage() {
  return <main className="page feedback-page"><header className="feedback-page__header"><p className="eyebrow">PARTICIPER AU CLUB</p><h1>Une idée ?<br /><em>Un souci ?</em></h1><p className="page-lede">Les idées enrichissent le club et restent visibles de tous. Les bugs et signalements sont transmis en privé à l’administration.</p></header><IdeasBoard /></main>;
}