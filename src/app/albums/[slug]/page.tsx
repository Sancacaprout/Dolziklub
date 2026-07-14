import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumCard } from "@/components/album-card";
import { RatingDisplay } from "@/components/rating-display";
import { albums, getAlbum } from "@/data/albums";
import { getMemberDisplayName } from "@/data/members";
import { getLiveAlbum } from "@/lib/live-albums";
import { youtubeMusicSearchUrl } from "@/lib/youtube-music";

export function generateStaticParams() {
  return albums.map(({ slug }) => ({ slug }));
}

export const dynamicParams = true;

async function resolveAlbum(slug: string) {
  return getAlbum(slug) ?? getLiveAlbum(slug).catch(() => null);
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
  const album = await resolveAlbum((await params).slug);
  if (!album) notFound();

  const isLive = album.id.startsWith("live-");
  const related = albums.filter((item) => item.id !== album.id).slice(-3).reverse();
  const status =
    album.status === "rated"
      ? "Écouté et évalué"
      : "Compte rendu encore scellé";
  const albumUrl = album.albumUrl ?? youtubeMusicSearchUrl(album.title, album.artist);
  const description = cleanDescription(album.albumDescription);
  const reviewer = getMemberDisplayName(album.listenedBy);
  const trackLink = (track: string | null) =>
    track ? youtubeMusicSearchUrl(track, album.artist, album.title) : null;

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
            {isLive ? "FICHE DU TIRAGE" : "FICHE D’ARCHIVE"}
          </p>
          <h1>
            <a
              className="album-title-link"
              href={albumUrl}
              target="_blank"
              rel="noreferrer"
              title={`Écouter ${album.title} sur YouTube Music`}
            >
              {album.title}
              <br />
              <em>{album.artist}</em>
            </a>
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
          <a className="music-link" href={albumUrl} target="_blank" rel="noreferrer">
            Écouter l’album sur YouTube Music <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      {(description || isLive) && (
        <section className="album-description">
          <div>
            <p className="eyebrow">À PROPOS DE L’ALBUM</p>
            <p>
              {description ??
                "Les informations sur cet album seront ajoutées au fur et à mesure des propositions du club."}
            </p>
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
            {album.bestTrack.title && trackLink(album.bestTrack.title) ? (
              <a href={trackLink(album.bestTrack.title)!} target="_blank" rel="noreferrer">
                {album.bestTrack.title}
                <small>Écouter sur YouTube Music ↗</small>
              </a>
            ) : <p>Pas encore renseigné</p>}
          </div>
          <div className="track-card track-card--worst">
            <span>Worst track</span>
            {album.worstTrack.title && trackLink(album.worstTrack.title) ? (
              <a href={trackLink(album.worstTrack.title)!} target="_blank" rel="noreferrer">
                {album.worstTrack.title}
                <small>Écouter sur YouTube Music ↗</small>
              </a>
            ) : <p>Pas encore renseigné</p>}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading"><h2>À fouiller ensuite</h2></div>
        <div className="album-grid">
          {related.map((item) => <AlbumCard key={item.id} album={item} />)}
        </div>
      </section>
    </main>
  );
}
