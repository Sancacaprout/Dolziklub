import { LiveClubRefresh } from "@/components/live-club-refresh";
import { MembersGrid } from "@/components/members-grid";
import { getClubSnapshot } from "@/lib/club-snapshot";
import { getMemberStats } from "@/lib/statistics";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const { albums, members } = await getClubSnapshot();
  const items = members.map((member) => {
    const stats = getMemberStats(albums, member.slug);
    return { member, proposed: stats.proposed.length, listened: stats.listened.length };
  });

  return (
    <main className="page">
      <LiveClubRefresh />
      <p className="eyebrow">LE CLUB</p>
      <h1>Les têtes<br/><em>derrière le bruit.</em></h1>
      <p className="page-lede">Les membres du Dol Ziklub, classés par ordre alphabétique. Chaque fiche rassemble leurs écoutes et propositions, archives et tirages publiés compris.</p>
      <MembersGrid items={items} />
    </main>
  );
}