import Link from "next/link";
import { albums } from "@/data/albums";
import { members } from "@/data/members";
import { ClubLiveMetrics } from "@/components/club-live-metrics";
import { RankingsBoard, type RankingMember } from "@/components/rankings-board";
import { getClubStats, getMemberStats } from "@/lib/statistics";

export default function RankingsPage() {
  const stats = getClubStats(albums);
  const topAlbums = albums.filter((album) => album.rating !== null && album.rating > 0).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title, "fr")).slice(0, 5);
  const rankingMembers: RankingMember[] = members.map((member) => {
    const memberStats = getMemberStats(albums, member.slug);
    const given = memberStats.listened.filter((album) => album.rating !== null && album.rating > 0);
    const received = memberStats.proposed.filter((album) => album.rating !== null && album.rating > 0);
    return { slug: member.slug, displayName: member.displayName, proposed: memberStats.proposed.length, listened: memberStats.listened.length, givenCount: given.length, givenSum: given.reduce((sum, album) => sum + (album.rating ?? 0), 0), receivedCount: received.length, receivedSum: received.reduce((sum, album) => sum + (album.rating ?? 0), 0) };
  });

  return <main className="page ranking-page">
    <p className="eyebrow">TABLEAU D’HONNEUR · ARCHIVE VIVANTE</p>
    <h1>Les chiffres<br /><em>ont du goût.</em></h1>
    <p className="page-lede">Le palmarès du club : les disques qui ont marqué, les oreilles les plus enthousiastes et celles qui font circuler les meilleures trouvailles.</p>
    <ClubLiveMetrics variant="poster" baseAlbums={stats.total} baseReviews={stats.rated} baseRatingSum={(stats.averageRating ?? 0) * stats.rated} baseMembers={members.length} />
    <section className="ranking-albums" aria-labelledby="album-ranking-title"><div className="ranking-albums__heading"><div><p className="eyebrow">LE TOP DES ARCHIVES</p><h2 id="album-ranking-title">Les disques<br /><em>qui restent.</em></h2></div><p>À égalité, l’ordre alphabétique tranche. Les notes sont sur cinq.</p></div><ol>{topAlbums.map((album, index) => <li key={album.id}><span>{String(index + 1).padStart(2, "0")}</span><Link href={`/albums/${album.slug}`}><b>{album.title}</b><small>{album.artist} · proposé par {album.proposedBy ?? "le club"}</small></Link><strong>{album.rating?.toFixed(1)}<small>/ 5</small></strong></li>)}</ol></section>
    <RankingsBoard members={rankingMembers} archiveTotal={stats.total} archiveRated={stats.rated} distribution={stats.distribution} />
  </main>;
}
