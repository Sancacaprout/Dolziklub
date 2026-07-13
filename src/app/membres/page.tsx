import Link from "next/link";
import { albums } from "@/data/albums";
import { members } from "@/data/members";
import { getMemberStats } from "@/lib/statistics";

export default function MembersPage() {
  return <main className="page"><p className="eyebrow">LE CLUB</p><h1>Les têtes<br/><em>derrière le bruit.</em></h1><p className="page-lede">Les membres du Ziklub, classés par ordre alphabétique. Chaque fiche rassemble désormais leurs vraies écoutes et propositions archivées.</p><div className="members-grid">{members.map((member, index) => { const stats = getMemberStats(albums, member.slug); return <Link href={`/membres/${member.slug}`} key={member.slug} className="member-card"><span className="member-card__number">{String(index + 1).padStart(2, "0")}</span><div className="member-card__avatar">{member.displayName.slice(0, 1)}</div><h2>{member.displayName}</h2><p>{member.role === "admin" ? "Administration" : "Membre"}</p><small>{stats.proposed.length} proposition{stats.proposed.length > 1 ? "s" : ""} · {stats.listened.length} écoute{stats.listened.length > 1 ? "s" : ""}</small></Link>; })}</div></main>;
}
