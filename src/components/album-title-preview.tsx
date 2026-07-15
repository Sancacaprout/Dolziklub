"use client";

import Link from "next/link";
import { useState } from "react";

type PreviewPosition = { left: number; top: number } | null;

export function AlbumTitlePreview({
  href,
  title,
  artist,
  cover,
  label,
}: {
  href: string;
  title: string;
  artist: string | null;
  cover: string | null;
  label: string;
}) {
  const [position, setPosition] = useState<PreviewPosition>(null);

  const showPreview = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = 280;
    const height = 372;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    const below = rect.bottom + 12;
    setPosition({
      left,
      top: below + height <= window.innerHeight - 12 ? below : Math.max(12, rect.top - height - 12),
    });
  };

  return (
    <Link
      className="sheet-album-title-link sheet-album-title-link--preview"
      href={href}
      onMouseEnter={(event) => showPreview(event.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocus={(event) => showPreview(event.currentTarget)}
      onBlur={() => setPosition(null)}
    >
      <b>{title}</b>
      {position && (
        <span
          aria-hidden="true"
          className="album-title-preview"
          style={{ left: position.left, top: position.top }}
        >
          <span className="album-title-preview__cover">
            {cover ? <img src={cover} alt="" /> : <span>DOL<br />ZIKLUB</span>}
          </span>
          <span className="album-title-preview__copy">
            <small>{label}</small>
            <strong>{title}</strong>
            {artist && <em>{artist}</em>}
          </span>
        </span>
      )}
    </Link>
  );
}
