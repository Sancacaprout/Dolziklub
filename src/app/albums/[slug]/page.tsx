import type { Metadata } from "next";
import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumCard } from "@/components/album-card";
import { RatingDisplay } from "@/components/rating-display";
import { albums } from "@/data/albums";
import { getMemberDisplayName } from "@/data/members";
import { getSynchronizedAlbums } from "@/lib/live-albums";
import { youtubeMusicSearchUrl } from "@/lib/youtube-music";
import { MusicChoiceButton, MusicTrackChoiceButton } from "@/components/music-player";
import { getArchivedReviewOverride } from "@/lib/archived-reviews";
import { AlbumEditorialEditor } from "@/components/album-editorial-editor";

export function generateStaticParams() {
  return albums.map(({ slug }) => ({ slug }));
}

export const dynamicParams = true;
export const dynamic = "force-dynamic";

const loadSynchronizedCatalog = cache(async () =>
  getSynchronizedAlbums().catch(() => albums),
);

async function resolveAlbum(slug: string) {
  return (await loadSynchronizedCatalog()).find((album) => album.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const album = await resolveAlbum((await params).slug);
  return {
    title: album
      ? `${album.title} — ${album.artist} | DOL ZIKLUB`
      : "Album introuvable",
  };
}

const cleanDescription = (value: string | null) =>
  value?.replaceAll("**", "").replace(/\s+/g, " ").trim() ?? null;

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  let album = await resolveAlbum((await params).slug);
  if (!album) notFound();

  const archivedReview = album.id.startsWith("archive-")
    ? await getArchivedReviewOverride(album.id).catch(() => null)
    : null;
  if (archivedReview?.is_modified) {
    album = {
      ...album,
      rating: archivedReview.rating ?? album.rating,
      shortReview: archivedReview.review ?? album.shortReview,
      detailedReview: null,
      bestTrack: {
        title: archivedReview.best_track ?? album.bestTrack.title,
        url: archivedReview.best_track ? null : album.bestTrack.url,
      },
      worstTrack: {
        title: archivedReview.worst_track ?? album.worstTrack.title,
        url: archivedReview.worst_track ? null : album.worstTrack.url,
      },
    };
  }

  const synchronizedAlbums = await loadSynchronizedCatalog();
  const isCurrentDraw = album.drawNumber != null && album.status === "pending";
  const isLive = album.id.startsWith("live-") || isCurrentDraw;
  const related = synchronizedAlbums.filter((item) => item.id !== album.id).slice(-3).reverse();
  const status =
    album.status === "rated"
      ? "Écouté et évalué"
      : "Compte rendu encore scellé";
  const albumUrl = album.albumUrl ?? youtubeMusicSearchUrl(album.title, album.artist);
  const description = cleanDescription(album.albumDescription);
  const artistDescription = cleanDescription(album.artistDescription);
  const reviewer = getMemberDisplayName(album.listenedBy);
  const trackLink = (track: string | null, storedUrl: string | null = null) =>
    track ? storedUrl ?? youtubeMusicSearchUrl(track, album.artist, album.title) : null;

  return (
    <main className="page album-page">
      <Link className="back" href="/albums">
        ← Retour au bac
      </Link>
      <section className="album-sheet">
        <div className="album-sheet__cover">
          {album.cover && (
            <Image
              src={album.cover}
              alt={`Pochette de ${album.title}`}
              fill
              sizes="(max-width: 700px) 90vw, 40vw"
              priority
            />
          )}
        </div>
        <div className="album-sheet__info">
          <p className="eyebrow">
            {isCurrentDraw || album.id.startsWith("live-") ? "FICHE DU TIRAGE" : "FICHE D’ARCHIVE"}
          </p>
          <h1>
            <MusicChoiceButton
              className="album-title-link"
              title={album.title}
              artist={album.artist}
              sourceUrl={albumUrl}
              externalUrl={albumUrl}
            >
              {album.title}
              <br />
              <em>{album.artist}</em>
            </MusicChoiceButton>
          </h1>
          <RatingDisplay rating={album.rating} />
          <dl>
            <div>
              <dt>Proposé par</dt>
              <dd>{getMemberDisplayName(album.proposedBy)}</dd>
            </div>
            <div>
              <dt>Écouté par</dt>
              <dd>{reviewer}</dd>
            </div>
            <div>
              <dt>Statut</dt>
              <dd>{status}</dd>
            </div>
          </dl>
          <MusicChoiceButton className="music-link" title={album.title} artist={album.artist} sourceUrl={albumUrl} externalUrl={albumUrl}>
            Écouter l’album sur YouTube Music <span aria-hidden="true">↗</span>
          </MusicChoiceButton>
        </div>
      </section>

      {(description || artistDescription || isLive) && (
        <section className="album-description">
          <div className="album-description__copy">
            <div>
              <p className="eyebrow">À PROPOS DE L’ALBUM</p>
              <p>
                {description ??
                  "Les informations sur cet album seront ajoutées au fur et à mesure des propositions du club."}
              </p>
            </div>
            {artistDescription && (
              <div>
                <p className="eyebrow">À PROPOS DE L’ARTISTE</p>
                <p>{artistDescription}</p>
              </div>
            )}
          </div>
          {(album.projectType || album.releaseYear || album.origin || album.language || album.genres.length > 0) && (
            <ul>
              {album.projectType && <li><b>Format</b>{album.projectType}</li>}
              {album.releaseYear && <li><b>Sortie</b>{album.releaseYear}</li>}
              {album.origin && <li><b>Origine</b>{album.origin}</li>}
              {album.language && <li><b>Langue</b>{album.language}</li>}
              {album.genres.length > 0 && <li><b>Univers</b>{album.genres.join(" · ")}</li>}
            </ul>
          )}
        </section>
      )}

      <section className="review-sheet">
        <div className="review-quote">
          <p className="eyebrow">VERDICT DE {reviewer.toUpperCase()}</p>
          <blockquote>{album.shortReview ?? "Le compte rendu est encore sous scellés."}</blockquote>
          {album.detailedReview && <p className="review-detail">{album.detailedReview}</p>}
        </div>
        <div className="track-box">
          <div className="track-card track-card--best">
            <span>Best track</span>
            {album.bestTrack.title && trackLink(album.bestTrack.title, album.bestTrack.url) ? (
              <MusicTrackChoiceButton
                title={album.bestTrack.title}
                artist={album.artist}
                albumTitle={album.title}
                youtubeMusicUrl={trackLink(album.bestTrack.title, album.bestTrack.url)!}
              >
                {album.bestTrack.title}
                <small>YouTube Music ou Deezer ▶</small>
              </MusicTrackChoiceButton>
            ) : <p>Pas encore renseigné</p>}
          </div>
          <div className="track-card track-card--worst">
            <span>Worst track</span>
            {album.worstTrack.title && trackLink(album.worstTrack.title, album.worstTrack.url) ? (
              <MusicTrackChoiceButton
                title={album.worstTrack.title}
                artist={album.artist}
                albumTitle={album.title}
                youtubeMusicUrl={trackLink(album.worstTrack.title, album.worstTrack.url)!}
              >
                {album.worstTrack.title}
                <small>YouTube Music ou Deezer ▶</small>
              </MusicTrackChoiceButton>
            ) : <p>Pas encore renseigné</p>}
          </div>
        </div>
      </section>

      {(album.liveEntryId || album.id.startsWith("archive-")) && (
        <AlbumEditorialEditor album={album} drawEntryId={album.liveEntryId ?? null} archiveAlbumId={album.id.startsWith("archive-") ? album.id : null} />
      )}

      <section className="section">
        <div className="section-heading"><h2>À fouiller ensuite</h2></div>
        <div className="album-grid">
          {related.map((item) => <AlbumCard key={item.id} album={item} />)}
        </div>
      </section>
    </main>
  );
}
