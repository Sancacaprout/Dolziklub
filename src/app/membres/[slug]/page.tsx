import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumCard } from "@/components/album-card";
import { MemberFavoriteAlbums } from "@/components/member-favorite-albums";
import { MemberPublicProfile } from "@/components/member-public-profile";
import { MemberStatsCards } from "@/components/member-stats-cards";
import { ProfileThemeBoundary } from "@/components/profile-theme-boundary";
import { albums } from "@/data/albums";
import { getMember } from "@/data/members";
import { getMemberStats } from "@/lib/statistics";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const member = getMember((await params).slug);
  if (!member) notFound();

  const stats = getMemberStats(albums, member.slug);
  const rated = (items: typeof stats.proposed) =>
    items.filter((album) => album.rating !== null && album.rating > 0).length;

  return (
    <ProfileThemeBoundary username={member.username}>
      <main className="page member-profile-page">
        <Link className="back" href="/membres">
          ← Tous les membres
        </Link>
        <MemberPublicProfile
          displayName={member.displayName}
          username={member.username}
          role={member.role}
        />
        <MemberFavoriteAlbums username={member.username} />
        <MemberStatsCards
          username={member.username ?? member.slug}
          base={{
            proposed: stats.proposed.length,
            listened: stats.listened.length,
            givenAverage: stats.givenAverage,
            givenCount: rated(stats.listened),
            receivedAverage: stats.receivedAverage,
            receivedCount: rated(stats.proposed),
          }}
        />
        <section className="member-archive">
          <div className="member-archive__heading">
            <p className="eyebrow">VERDICTS RENDUS</p>
            <h2>Ce que {member.displayName} a écouté.</h2>
          </div>
          {stats.listened.length ? (
            <div className="album-grid">
              {stats.listened.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          ) : (
            <p className="member-archive__empty">
              Aucune écoute n’est encore archivée.
            </p>
          )}
        </section>
        <section className="member-archive">
          <div className="member-archive__heading">
            <p className="eyebrow">ALBUMS ENVOYÉS DANS LE BAC</p>
            <h2>Ce que {member.displayName} a proposé.</h2>
          </div>
          {stats.proposed.length ? (
            <div className="album-grid">
              {stats.proposed.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          ) : (
            <p className="member-archive__empty">
              Aucune proposition n’est encore archivée.
            </p>
          )}
        </section>
      </main>
    </ProfileThemeBoundary>
  );
}
