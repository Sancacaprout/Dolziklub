import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumCard } from "@/components/album-card";
import { MemberPublicProfile } from "@/components/member-public-profile";
import { getMember } from "@/data/members";
import { albums } from "@/data/albums";
import { getMemberStats } from "@/lib/statistics";

const formatAverage = (value: number | null) => value === null ? "—" : value.toFixed(1).replace(".", ",");

export default async function MemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const member = getMember((await params).slug);
  if (!member) notFound();
  const stats = getMemberStats(albums, member.slug);

  return <main className="page"><Link className="back" href="/membres">← Tous les membres</Link><MemberPublicProfile displayName={member.displayName} username={member.username} role={member.role} /><div className="stat-cards"><div><b>{stats.proposed.length}</b><span>propositions</span></div><div><b>{stats.listened.length}</b><span>écoutes</span></div><div><b>{formatAverage(stats.givenAverage)}</b><span className="stat-cards__label">Note moyenne attribuée</span></div><div><b>{formatAverage(stats.receivedAverage)}</b><span className="stat-cards__label">Note moyenne obtenue</span></div></div><section className="member-archive"><div className="member-archive__heading"><p className="eyebrow">VERDICTS RENDUS</p><h2>Ce que {member.displayName} a écouté.</h2></div>{stats.listened.length ? <div className="album-grid">{stats.listened.map((album) => <AlbumCard key={album.id} album={album} />)}</div> : <p className="member-archive__empty">Aucune écoute n’est encore archivée.</p>}</section><section className="member-archive"><div className="member-archive__heading"><p className="eyebrow">ALBUMS ENVOYÉS DANS LE BAC</p><h2>Ce que {member.displayName} a proposé.</h2></div>{stats.proposed.length ? <div className="album-grid">{stats.proposed.map((album) => <AlbumCard key={album.id} album={album} />)}</div> : <p className="member-archive__empty">Aucune proposition n’est encore archivée.</p>}</section></main>;
}
