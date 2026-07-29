import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumCard } from "@/components/album-card";
import { LiveClubRefresh } from "@/components/live-club-refresh";
import { MemberFavoriteAlbums } from "@/components/member-favorite-albums";
import { MemberFavoriteTracks } from "@/components/member-favorite-tracks";
import { MemberFavoriteArtists } from "@/components/member-favorite-artists";
import { MemberFavoriteClip } from "@/components/member-favorite-clip";
import { MemberBonusReviews } from "@/components/member-bonus-reviews";
import { MemberPublicProfile } from "@/components/member-public-profile";
import { MemberStatsCards } from "@/components/member-stats-cards";
import { ProfileThemeBoundary } from "@/components/profile-theme-boundary";
import { memberIdentityKeys } from "@/data/members";
import { getClubSnapshot } from "@/lib/club-snapshot";
import { getMemberExtraListeningAlbums } from "@/lib/member-extra-listenings";
import { isProfileThemeId } from "@/lib/profile-themes";
import { getMemberStats } from "@/lib/statistics";

export const dynamic = "force-dynamic";

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ previewTheme?: string; profilePreview?: string; themeLocked?: string }>;
}) {
  const requestedSlug = (await params).slug.trim().toLocaleLowerCase();
  const query = await searchParams;
  const forcedTheme = isProfileThemeId(query.previewTheme)
    ? query.previewTheme
    : null;
  const previewMode = query.profilePreview === "1";
  const snapshot = await getClubSnapshot();
  const member = snapshot.members.find((item) =>
    memberIdentityKeys(item).includes(requestedSlug),
  );
  if (!member) notFound();

  const stats = getMemberStats(snapshot.albums, member.slug);
  const extraAlbums = await getMemberExtraListeningAlbums(member.slug);
  const listenedCount = stats.listened.length + extraAlbums.listened.length;
  const proposedCount = stats.proposed.length + extraAlbums.proposed.length;

  return (
    <ProfileThemeBoundary
      username={member.username}
      forcedTheme={forcedTheme}
      previewMode={previewMode}
      lockedPreview={query.themeLocked === "1"}
    >
      <main className="page member-profile-page">
        <LiveClubRefresh />
        <Link className="back" href="/membres">
          ← Tous les membres
        </Link>
        <MemberPublicProfile
          displayName={member.displayName}
          username={member.username}
          role={member.role}
        />
        <MemberFavoriteAlbums username={member.username} />
        <MemberFavoriteTracks username={member.username} />
        <MemberFavoriteArtists username={member.username} />
        <MemberFavoriteClip username={member.username} />
        <MemberStatsCards
          username={member.username ?? member.slug}
          base={{
            proposed: proposedCount,
            listened: listenedCount,
            givenAverage: stats.givenAverage,
            receivedAverage: stats.receivedAverage,
          }}
        />
        <section className="member-archive member-archive--listened">
          <div className="member-archive__heading">
            <p className="eyebrow">VERDICTS RENDUS</p>
            <h2>Ce que {member.displayName} a écouté.</h2>
          </div>
          {listenedCount ? (
            <div className="album-grid">
              {extraAlbums.listened.map((entry) => (
                <AlbumCard
                  key={entry.album.id}
                  album={entry.album}
                  sourceLabel={entry.sourceLabel}
                  hrefOverride={entry.href}
                  external={entry.external}
                />
              ))}
              {stats.listened.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  sourceLabel={album.drawNumber
                    ? `Tirage classique · Tirage ${String(album.drawNumber).padStart(2, "0")}`
                    : "Tirage classique"}
                />
              ))}
            </div>
          ) : (
            <p className="member-archive__empty">
              Aucune écoute n’est encore enregistrée.
            </p>
          )}
        </section>
        <section className="member-archive member-archive--proposed">
          <div className="member-archive__heading">
            <p className="eyebrow">ALBUMS ENVOYÉS DANS LE BAC</p>
            <h2>Ce que {member.displayName} a proposé.</h2>
          </div>
          {proposedCount ? (
            <div className="album-grid">
              {extraAlbums.proposed.map((entry) => (
                <AlbumCard
                  key={entry.album.id}
                  album={entry.album}
                  sourceLabel={entry.sourceLabel}
                  hrefOverride={entry.href}
                  external={entry.external}
                />
              ))}
              {stats.proposed.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  sourceLabel={album.drawNumber
                    ? `Tirage classique · Tirage ${String(album.drawNumber).padStart(2, "0")}`
                    : "Tirage classique"}
                />
              ))}
            </div>
          ) : (
            <p className="member-archive__empty">
              Aucune proposition n’est encore enregistrée.
            </p>
          )}
        </section>
        <MemberBonusReviews username={member.username} albums={snapshot.albums} />
      </main>
    </ProfileThemeBoundary>
  );
}
