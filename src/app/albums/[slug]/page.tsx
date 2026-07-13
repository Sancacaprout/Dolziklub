import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumCard } from "@/components/album-card";
import { RatingDisplay } from "@/components/rating-display";
import { albums, getAlbum } from "@/data/albums";
import { getMemberDisplayName } from "@/data/members";

export function generateStaticParams() { return albums.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const album = getAlbum((await params).slug);
  return { title: album ? `${album.title} — ${album.artist} | DOL ZIKLUB` : "Album introuvable" };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const album = getAlbum((await params).slug);
  if (!album) notFound();
  const related = albums.filter((item) => item.id !== album.id).slice(-3).reverse();
  const status = album.status === "rated" ? "Écouté et évalué" : "Écoute ou évaluation en attente";

  return <main className="page album-page"><Link className="back" href="/albums">← Retour au bac</Link><section className="album-sheet"><div className="album-sheet__cover">{album.cover && <Image src={album.cover} alt={`Pochette de ${album.title}`} fill sizes="(max-width: 700px) 90vw, 40vw" priority />}</div><div><p className="eyebrow">FICHE D’ARCHIVE</p><h1>{album.title}<br/><em>{album.artist}</em></h1><RatingDisplay rating={album.rating} /><dl><div><dt>Proposé par</dt><dd>{getMemberDisplayName(album.proposedBy)}</dd></div><div><dt>Écouté par</dt><dd>{getMemberDisplayName(album.listenedBy)}</dd></div><div><dt>Statut</dt><dd>{status}</dd></div></dl>{album.albumDescription && <p className="notice">{album.albumDescription}</p>}</div></section><section className="review-sheet"><div><p className="eyebrow">VERDICT DE {getMemberDisplayName(album.listenedBy).toUpperCase()}</p><h2>{album.shortReview ?? "Le compte rendu est encore sous scellés."}</h2>{album.detailedReview && <p>{album.detailedReview}</p>}</div><div className="track-box"><b>Best track</b><span>{album.bestTrack.title ?? "Non renseigné"}</span><b>Worst track</b><span>{album.worstTrack.title ?? "Non renseigné"}</span></div></section><section className="section"><div className="section-heading"><h2>À fouiller ensuite</h2></div><div className="album-grid">{related.map((item) => <AlbumCard key={item.id} album={item} />)}</div></section></main>;
}
