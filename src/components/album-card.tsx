"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getMemberDisplayName } from "@/data/members";
import { RatingDisplay } from "@/components/rating-display";
import { resolvedArchiveNumber } from "@/lib/archive-number-fallbacks";
import { getArchiveCoverFallback } from "@/data/archive-cover-fallbacks";
import type { Album } from "@/types/album";

export function AlbumCard({
  album,
  compact = false,
  list = false,
}: {
  album: Album;
  compact?: boolean;
  list?: boolean;
  currentDraw?: boolean;
}) {
  const fallbackCover = getArchiveCoverFallback(album.id) ?? "/album-a-venir.png";
  const preferredCover = album.cover ?? fallbackCover;
  const preferredCoverKey = `${album.id}:${preferredCover}`;
  const [failedCoverKey, setFailedCoverKey] = useState<string | null>(null);
  const coverSrc = failedCoverKey === preferredCoverKey ? fallbackCover : preferredCover;
  const archiveNumber = resolvedArchiveNumber(album);
  const archiveDraw = archiveNumber == null
    ? null
    : archiveNumber <= 10 ? 1
      : archiveNumber <= 19 ? 2
        : archiveNumber <= 28 ? 3
          : archiveNumber <= 36 ? 4
            : archiveNumber <= 45 ? 5
              : archiveNumber <= 52 ? 6
                : album.drawNumber ?? null;
  const archiveLabel = archiveNumber == null
    ? "Album a venir"
    : `Archive #${archiveNumber} - Tirage ${String(archiveDraw ?? 1).padStart(2, "0")}`;
  const href = `/albums/${album.slug}`;
  const cover = coverSrc ? <Image src={coverSrc} alt={`Pochette de ${album.title} par ${album.artist}`} fill quality={90} sizes={list ? "170px" : compact ? "110px" : "(max-width: 700px) 46vw, 260px"} onError={() => { if (coverSrc !== fallbackCover) setFailedCoverKey(preferredCoverKey); }} /> : <Image src={fallbackCover} alt={`Pochette non disponible pour ${album.title} par ${album.artist}`} fill quality={90} sizes={list ? "170px" : compact ? "110px" : "(max-width: 700px) 46vw, 260px"} />;

  if (list) return <Link className="album-card album-card--list" href={href}><div className="cover-frame">{cover}</div><div className="album-card__list-main"><p className="eyebrow">{archiveLabel}</p><h3>{album.title}</h3><p>{album.artist}</p></div><div className="album-card__list-credits"><p>Proposé par <b>{getMemberDisplayName(album.proposedBy)}</b></p><p>Écouté par <b>{getMemberDisplayName(album.listenedBy)}</b></p></div><div className="album-card__list-rating"><RatingDisplay rating={album.rating} /></div></Link>;
  return <Link className={`album-card ${compact ? "album-card--compact" : ""}`} href={href}><div className="cover-frame">{cover}</div><div className="album-card__copy"><p className="eyebrow">{archiveLabel}</p><h3>{album.title}</h3><p>{album.artist}</p><p className="album-card__credit">Proposé par <b>{getMemberDisplayName(album.proposedBy)}</b></p><p className="album-card__credit">Écouté par <b>{getMemberDisplayName(album.listenedBy)}</b></p><RatingDisplay rating={album.rating} /></div></Link>;
}