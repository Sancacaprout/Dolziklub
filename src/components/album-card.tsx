import Image from "next/image";
import Link from "next/link";
import { getMemberDisplayName } from "@/data/members";
import { RatingDisplay } from "@/components/rating-display";
import type { Album } from "@/types/album";

export function AlbumCard({ album, compact = false, list = false }: { album: Album; compact?: boolean; list?: boolean }) {
  const isLive = album.id.startsWith("live-");
  const href = `/albums/${album.slug}`;
  const archiveLabel = isLive ? "Tirage en cours" : `Archive #${album.id.replace("archive-", "")}`;
  const cover = album.cover ? <Image src={album.cover} alt={`Pochette de ${album.title} par ${album.artist}`} fill quality={90} sizes={list ? "170px" : "(max-width: 700px) 46vw, 260px"} /> : <span>Sans pochette</span>;

  if (list) return <Link className="album-card album-card--list" href={href}><div className="cover-frame">{cover}</div><div className="album-card__list-main"><p className="eyebrow">{archiveLabel}</p><h3>{album.title}</h3><p>{album.artist}</p></div><div className="album-card__list-credits"><p>Proposé par <b>{getMemberDisplayName(album.proposedBy)}</b></p><p>Écouté par <b>{getMemberDisplayName(album.listenedBy)}</b></p></div><div className="album-card__list-rating"><RatingDisplay rating={album.rating} /></div></Link>;
  return <Link className={`album-card ${compact ? "album-card--compact" : ""}`} href={href}><div className="cover-frame">{cover}</div><div className="album-card__copy"><p className="eyebrow">{archiveLabel}</p><h3>{album.title}</h3><p>{album.artist}</p><p className="album-card__credit">Proposé par <b>{getMemberDisplayName(album.proposedBy)}</b></p><p className="album-card__credit">Écouté par <b>{getMemberDisplayName(album.listenedBy)}</b></p><RatingDisplay rating={album.rating} /></div></Link>;
}
