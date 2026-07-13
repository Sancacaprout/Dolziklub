import { albums } from "@/data/albums";
import { members } from "@/data/members";
import { ClubLiveMetrics } from "@/components/club-live-metrics";
import { getClubStats } from "@/lib/statistics";

export default function RankingsPage() {
  const stats = getClubStats(albums);
  return <main className="page"><p className="eyebrow">TABLEAU D’HONNEUR</p><h1>Les chiffres<br/><em>ne mentent pas.</em></h1><p className="page-lede">Le panneau de contrôle du goût collectif.</p><ClubLiveMetrics variant="poster" baseAlbums={stats.total} baseReviews={stats.rated} baseRatingSum={(stats.averageRating ?? 0) * stats.rated} baseMembers={members.length} /><section className="ranking-placeholder"><p className="eyebrow">ARCHIVE VIVANTE</p><h2>Les indicateurs se mettent à jour dès qu’un album est proposé ou qu’un verdict est rendu.</h2><p>Les albums sans note restent exclus des moyennes.</p></section></main>;
}
