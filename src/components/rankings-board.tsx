"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type RankingMember = { slug: string; displayName: string; proposed: number; listened: number; givenCount: number; givenSum: number; receivedCount: number; receivedSum: number };
type LiveMemberMetrics = { proposed_count: number; listened_count: number; given_count: number; given_sum: number; received_count: number; received_sum: number };
type LiveClubMetrics = { album_count: number; review_count: number };

function average(sum: number, count: number) { return count ? sum / count : null; }
function score(value: number | null) { return value === null ? "—" : value.toFixed(2); }
function participationCount(member: RankingMember) { return member.proposed + member.listened; }

export function RankingsBoard({ members, archiveTotal, archiveRated, distribution }: { members: RankingMember[]; archiveTotal: number; archiveRated: number; distribution: Array<{ score: number; count: number }> }) {
  const configured = isSupabaseConfigured();
  const [liveMembers, setLiveMembers] = useState<Record<string, LiveMemberMetrics>>({});
  const [liveClub, setLiveClub] = useState<LiveClubMetrics | null>(null);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    void Promise.all([supabase.rpc("get_public_club_draw_metrics"), ...members.map((member) => supabase.rpc("get_public_member_draw_metrics", { p_username: member.slug }))]).then(([clubResult, ...memberResults]) => {
      if (!clubResult.error && clubResult.data?.[0]) setLiveClub(clubResult.data[0] as LiveClubMetrics);
      const next: Record<string, LiveMemberMetrics> = {};
      memberResults.forEach((result, index) => { if (!result.error && result.data?.[0]) next[members[index].slug] = result.data[0] as LiveMemberMetrics; });
      setLiveMembers(next);
    });
  }, [configured, members]);

  const totals = useMemo(() => members.map((member) => {
    const live = liveMembers[member.slug];
    return { ...member, proposed: member.proposed + Number(live?.proposed_count ?? 0), listened: member.listened + Number(live?.listened_count ?? 0), givenCount: member.givenCount + Number(live?.given_count ?? 0), givenSum: member.givenSum + Number(live?.given_sum ?? 0), receivedCount: member.receivedCount + Number(live?.received_count ?? 0), receivedSum: member.receivedSum + Number(live?.received_sum ?? 0) };
  }), [liveMembers, members]);
  const listeners = [...totals].filter((member) => member.givenCount > 0).sort((a, b) => (average(b.givenSum, b.givenCount) ?? 0) - (average(a.givenSum, a.givenCount) ?? 0) || b.givenCount - a.givenCount).slice(0, 5);
  const curators = [...totals].filter((member) => member.receivedCount > 0).sort((a, b) => (average(b.receivedSum, b.receivedCount) ?? 0) - (average(a.receivedSum, a.receivedCount) ?? 0) || b.receivedCount - a.receivedCount).slice(0, 5);
  const mostActive = [...totals].sort((a, b) => participationCount(b) - participationCount(a) || b.proposed - a.proposed).slice(0, 5);
  const harshListeners = [...totals].filter((member) => member.givenCount > 0).sort((a, b) => (average(a.givenSum, a.givenCount) ?? 0) - (average(b.givenSum, b.givenCount) ?? 0) || b.givenCount - a.givenCount).slice(0, 5);
  const rejectedCurators = [...totals].filter((member) => member.receivedCount > 0).sort((a, b) => (average(a.receivedSum, a.receivedCount) ?? 0) - (average(b.receivedSum, b.receivedCount) ?? 0) || b.receivedCount - a.receivedCount).slice(0, 5);
  const leastActive = [...totals].sort((a, b) => participationCount(a) - participationCount(b) || a.displayName.localeCompare(b.displayName, "fr")).slice(0, 5);
  const liveAlbums = Number(liveClub?.album_count ?? 0);
  const liveReviews = Number(liveClub?.review_count ?? 0);
  const maxDistribution = Math.max(1, ...distribution.map((item) => item.count));
  const popularScore = [...distribution].sort((a, b) => b.count - a.count || b.score - a.score)[0];
  const completionRate = archiveTotal ? Math.round((archiveRated / archiveTotal) * 100) : 0;

  return <>
    <section className="ranking-pulse" aria-label="Activité du classement"><div><span className="ranking-pulse__light" aria-hidden="true" /> <b>Classement en mouvement</b><p>{liveClub ? `${liveAlbums} album${liveAlbums > 1 ? "s" : ""} du tirage en cours · ${liveReviews} verdict${liveReviews > 1 ? "s" : ""} reçu${liveReviews > 1 ? "s" : ""}` : "Les données du tirage s’ajoutent dès qu’elles sont publiées."}</p></div><span>{archiveRated + liveReviews} notes comptabilisées</span></section>
    <section className="ranking-highlights" aria-label="Les chiffres à retenir"><article><span>TAUX DE VERDICTS</span><b>{completionRate}%</b><p>{archiveRated} des {archiveTotal} albums archivés ont une note.</p></article><article><span>NOTE PRÉFÉRÉE</span><b>{popularScore?.score ?? "—"}<small>/ 5</small></b><p>La note la plus souvent attribuée dans l’archive.</p></article><article><span>EN ATTENTE</span><b>{Math.max(0, archiveTotal - archiveRated)}</b><p>Albums archivés qui n’ont pas encore reçu de verdict.</p></article></section>
    <section className="ranking-columns" aria-label="Classements positifs des membres"><RankingList title="Oreille d’or" subtitle="Les notes les plus généreuses" members={listeners} metric={(member) => score(average(member.givenSum, member.givenCount))} detail={(member) => `${member.givenCount} verdict${member.givenCount > 1 ? "s" : ""}`} /><RankingList title="Meilleur prescripteur" subtitle="Les albums les mieux reçus" members={curators} metric={(member) => score(average(member.receivedSum, member.receivedCount))} detail={(member) => `${member.receivedCount} album${member.receivedCount > 1 ? "s" : ""} noté${member.receivedCount > 1 ? "s" : ""}`} /><RankingList title="Plus actif" subtitle="Propositions + écoutes" members={mostActive} metric={(member) => String(participationCount(member)).padStart(2, "0")} detail={(member) => `${member.proposed} propositions · ${member.listened} écoutes`} /></section>
    <section className="ranking-reverse" aria-labelledby="reverse-title"><div className="ranking-reverse__heading"><p className="eyebrow">LE REVERS DU PODIUM</p><h2 id="reverse-title">Les classements<br /><em>moins glorieux.</em></h2><p>Ils utilisent les mêmes moyennes et participations que les tableaux ci-dessus, simplement dans l’autre sens.</p></div><div className="ranking-columns ranking-columns--reverse"><RankingList title="Prescripteur boudé" subtitle="Les albums les moins bien reçus" members={rejectedCurators} metric={(member) => score(average(member.receivedSum, member.receivedCount))} detail={(member) => `${member.receivedCount} album${member.receivedCount > 1 ? "s" : ""} noté${member.receivedCount > 1 ? "s" : ""}`} /><RankingList title="Moins actif" subtitle="Le moins de participations" members={leastActive} metric={(member) => String(participationCount(member)).padStart(2, "0")} detail={(member) => `${member.proposed} propositions · ${member.listened} écoutes`} /><RankingList title="Oreille sévère" subtitle="Les notes les plus basses" members={harshListeners} metric={(member) => score(average(member.givenSum, member.givenCount))} detail={(member) => `${member.givenCount} verdict${member.givenCount > 1 ? "s" : ""}`} /></div></section>
    <section className="ranking-distribution" aria-labelledby="distribution-title"><div><p className="eyebrow">THERMOMÈTRE DU CLUB</p><h2 id="distribution-title">La répartition<br /><em>des verdicts.</em></h2><p>Chaque barre reprend les notes de l’archive. Les albums en attente restent volontairement hors calcul.</p></div><div className="ranking-bars" role="list" aria-label="Répartition des notes">{distribution.map((item) => <div className="ranking-bar" key={item.score} role="listitem"><span>{item.score}/5</span><div aria-label={`${item.count} albums notés ${item.score} sur 5`}><i style={{ width: `${(item.count / maxDistribution) * 100}%` }} /></div><b>{item.count}</b></div>)}</div></section>
  </>;
}

function RankingList({ title, subtitle, members, metric, detail }: { title: string; subtitle: string; members: RankingMember[]; metric: (member: RankingMember) => string; detail: (member: RankingMember) => string }) {
  const isParticipationRanking = title === "Plus actif" || title === "Moins actif";
  return <article className="ranking-list"><header><p className="eyebrow">{subtitle}</p><h2>{title}</h2></header><ol>{members.length ? members.map((member, index) => <li key={member.slug}><span>{String(index + 1).padStart(2, "0")}</span><Link href={`/membres/${member.slug}`}><b>{member.displayName}</b><small>{detail(member)}</small></Link><strong>{metric(member)}<small>{isParticipationRanking ? " participations" : " / 5"}</small></strong></li>) : <li className="ranking-list__empty">Le premier verdict fera apparaître ce classement.</li>}</ol></article>;
}
