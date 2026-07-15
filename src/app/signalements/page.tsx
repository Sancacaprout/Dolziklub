import { AdminReportsBoard } from "@/components/admin-reports-board";

export const metadata = { title: "Signalements — Administration DOL ZIKLUB" };

export default function ReportsPage() {
  return <main className="page feedback-page"><header className="feedback-page__header"><p className="eyebrow">ADMINISTRATION</p><h1>Boîte des<br /><em>signalements.</em></h1><p className="page-lede">Espace privé de suivi des bugs et signalements envoyés par les membres.</p></header><AdminReportsBoard /></main>;
}