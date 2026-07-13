import Image from "next/image";
import Link from "next/link";
import { getMemberDisplayName } from "@/data/members";
import { RatingDisplay } from "@/components/rating-display";
import type { Album } from "@/types/album";

export function AlbumCard({ album, compact = false }: { album: Album; compact?: boolean }) {
  return <Link className={`album-card ${compact ? "album-card--compact" : ""}`} href={`/albums/${album.slug}`}>
    <div className="cover-frame">{album.cover ? <Image src={album.cover} alt={`Pochette de ${album.title} par ${album.artist}`} fill sizes="(max-width: 700px) 46vw, 260px" /> : <span>Sans pochette</span>}</div>
    <div className="album-card__copy"><p className="eyebrow">Archive #{album.id.replace("archive-", "")}</p><h3>{album.title}</h3><p>{album.artist}</p><p className="album-card__credit">Proposé par <b>{getMemberDisplayName(album.proposedBy)}</b></p><p className="album-card__credit">Écouté par <b>{getMemberDisplayName(album.listenedBy)}</b></p><RatingDisplay rating={album.rating} /></div>
  </Link>;
}
