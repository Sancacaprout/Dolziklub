"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { RatingDisplay } from "@/components/rating-display";
import { ReviewPreview } from "@/components/review-preview";
import { AlbumTitlePreview } from "@/components/album-title-preview";
import { albums as archivedAlbums } from "@/data/albums";
import { members } from "@/data/members";
import { normalizeMusicText } from "@/lib/music-matching";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { MusicTrackChoiceButton } from "@/components/music-player";
import type { Album } from "@/types/album";
import { youtubeMusicSearchUrl } from "@/lib/youtube-music";

type Entry = {
  id: string;
  draw_number: number;
  archive_number?: number | null;
  position: number;
  proposed_by: string | null;
  listened_by: string | null;
  proposed_by_name: string | null;
  listened_by_name: string | null;
  album_title: string | null;
  album_artist: string | null;
  cover_path?: string | null;
  cover_source_url?: string | null;
  youtube_music_url?: string | null;
};
type Review = {
  album_id: string;
  review_title: string | null;
  review: string;
  rating: number;
  best_track: string | null;
  worst_track: string | null;
  best_track_youtube_music_url?: string | null;
  worst_track_youtube_music_url?: string | null;
};
type Draw = { draw_number: number; status: "draft" | "published" | "locked"; draw_type?: "standard" | "global" };
type BonusReview = { entry_id: string | null; member_username: string; member_display_name: string; review_title: string | null; review: string; rating: number; best_track: string | null; worst_track: string | null };
type Member = { id: string; username: string; displayName: string };
type StickyHeader = {
  left: number;
  width: number;
  top: number;
  tableWidth: number;
  scrollLeft: number;
} | null;

function memberName(name: string | null) {
  if (!name) return "—";
  return name.trim().toLocaleLowerCase() === "thomas"
    ? "Toma"
    : `${name.slice(0, 1).toLocaleUpperCase()}${name.slice(1)}`;
}
function memberProfileHref(name: string | null) {
  const key = name?.trim().toLocaleLowerCase();
  const clubMember = members.find((candidate) =>
    [candidate.slug, candidate.username, candidate.displayName].some((value) => value?.toLocaleLowerCase() === key),
  );
  return clubMember ? `/membres/${clubMember.slug}` : null;
}
function MemberProfileLink({ name }: { name: string | null }) {
  const href = memberProfileHref(name);
  const label = memberName(name);
  return href ? <Link className="sheet-member sheet-member--link" href={href} onClick={(event) => event.stopPropagation()} aria-label={`Voir le profil de ${label}`}>{label}</Link> : <span className="sheet-member">{label}</span>;
}
function assigned(entry: Entry, member: Member, side: "proposer" | "listener") {
  const id = side === "proposer" ? entry.proposed_by : entry.listened_by;
  const name =
    side === "proposer" ? entry.proposed_by_name : entry.listened_by_name;
  return (
    id === member.id ||
    [member.username, member.displayName].some(
      (value) =>
        value.trim().toLocaleLowerCase() === name?.trim().toLocaleLowerCase(),
    )
  );
}
function emptySlot(entry: Entry) {
  return (
    !entry.album_title?.trim() ||
    !entry.album_artist?.trim() ||
    /^album\s*[-–—]\s*artiste$/i.test(entry.album_title)
  );
}

function archiveLabel(entry: Entry) {
  const draw = String(entry.draw_number).padStart(2, "0");
  return entry.archive_number == null
    ? `Tirage ${draw}`
    : `Archive #${entry.archive_number} - Tirage ${draw}`;
}

function sameAlbum(entry: Entry, album: Album) {
  return (
    normalizeMusicText(entry.album_title ?? "") ===
      normalizeMusicText(album.title) &&
    normalizeMusicText(entry.album_artist ?? "") ===
      normalizeMusicText(album.artist)
  );
}

function previewCoverUrl(entry: Entry, archivedAlbum: Album | undefined) {
  if (entry.cover_path && isSupabaseConfigured()) {
    return getSupabaseBrowserClient().storage.from("album-covers").getPublicUrl(entry.cover_path).data.publicUrl;
  }
  return entry.cover_source_url ?? archivedAlbum?.cover ?? null;
}

function HeaderRow() {
  return (
    <tr>
      <th>Album · Artiste</th>
      <th>Proposé par</th>
      <th>Écouté par</th>
      <th>Avis</th>
      <th>Note</th>
      <th>Morceau le plus convaincant</th>
      <th>Morceau le moins convaincant</th>
    </tr>
  );
}

export function StickyDrawShell({
  heading,
  children,
}: {
  heading: ReactNode;
  children: ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [stickyHeader, setStickyHeader] = useState<StickyHeader>(null);

  useEffect(() => {
    const update = () => {
      const section = sectionRef.current;
      const scroll = scrollRef.current;
      const table = tableRef.current;
      const header = table?.tHead;
      if (!section || !scroll || !table || !header) return;
      const scrollRect = scroll.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const headerHeight = header.getBoundingClientRect().height;
      const active = scrollRect.top < 0 && sectionRect.bottom > 0;
      if (!active) {
        setStickyHeader(null);
        return;
      }
      setStickyHeader({
        left: scrollRect.left,
        width: scrollRect.width,
        top: Math.min(0, sectionRect.bottom - headerHeight),
        tableWidth: table.scrollWidth,
        scrollLeft: scroll.scrollLeft,
      });
    };
    const scroll = scrollRef.current;
    const observer = new ResizeObserver(update);
    if (scroll) observer.observe(scroll);
    if (sectionRef.current) observer.observe(sectionRef.current);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    scroll?.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      scroll?.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <section className="draw-section draw-section--live" ref={sectionRef}>
      {stickyHeader && (
        <div
          aria-hidden="true"
          className="sticky-draw-header"
          style={{
            left: stickyHeader.left,
            top: stickyHeader.top,
            width: stickyHeader.width,
          }}
        >
          <table
            className="sheet-table"
            style={{
              width: stickyHeader.tableWidth,
              minWidth: stickyHeader.tableWidth,
              transform: `translateX(-${stickyHeader.scrollLeft}px)`,
            }}
          >
            <thead>
              <HeaderRow />
            </thead>
          </table>
        </div>
      )}
      {heading}
      <div className="sheet-scroll" ref={scrollRef}>
        <table className="sheet-table" ref={tableRef}>
          <thead>
            <HeaderRow />
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

function LiveDraw({
  draw,
  rows,
  reviews,
  bonusReviews,
  member,
  onOpenProposal,
  onOpenReview,
  focusEntryId,
}: {
  draw: Draw;
  rows: Entry[];
  reviews: Map<string, Review>;
  bonusReviews: Map<string, BonusReview[]>;
  member: Member | null;
  onOpenProposal: (id: string) => void;
  onOpenReview: (id: string) => void;
  focusEntryId: string | null;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [stickyHeader, setStickyHeader] = useState<StickyHeader>(null);

  useEffect(() => {
    const update = () => {
      const section = sectionRef.current;
      const scroll = scrollRef.current;
      const table = tableRef.current;
      const header = table?.tHead;
      if (!section || !scroll || !table || !header) return;
      const scrollRect = scroll.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const headerHeight = header.getBoundingClientRect().height;
      const active = scrollRect.top < 0 && sectionRect.bottom > 0;
      if (!active) {
        setStickyHeader(null);
        return;
      }
      setStickyHeader({
        left: scrollRect.left,
        width: scrollRect.width,
        top: Math.min(0, sectionRect.bottom - headerHeight),
        tableWidth: table.scrollWidth,
        scrollLeft: scroll.scrollLeft,
      });
    };
    const scroll = scrollRef.current;
    const observer = new ResizeObserver(update);
    if (scroll) observer.observe(scroll);
    if (sectionRef.current) observer.observe(sectionRef.current);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    scroll?.addEventListener("scroll", update, { passive: true });
    update();
  return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      scroll?.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    if (!focusEntryId || !rows.some((entry) => entry.id === focusEntryId)) {
      return;
    }

    document
      .getElementById(`draw-entry-${focusEntryId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusEntryId, rows]);

  const editableEntry = member && draw.status === "locked" ? rows.find((entry) => assigned(entry, member, "listener") && Boolean(reviews.get(entry.id))) ?? null : null;

  return (
    <section className="draw-section draw-section--live" ref={sectionRef}>
      {stickyHeader && (
        <div
          aria-hidden="true"
          className="sticky-draw-header"
          style={{
            left: stickyHeader.left,
            top: stickyHeader.top,
            width: stickyHeader.width,
          }}
        >
          <table
            className="sheet-table"
            style={{
              width: stickyHeader.tableWidth,
              minWidth: stickyHeader.tableWidth,
              transform: `translateX(-${stickyHeader.scrollLeft}px)`,
            }}
          >
            <thead>
              <HeaderRow />
            </thead>
          </table>
        </div>
      )}
      <div className="draw-heading">
        <span className="eyebrow">
          TIRAGE {String(draw.draw_number).padStart(2, "0")} ·{" "}
          {draw.status === "locked" ? "ARCHIVÉ" : "EN COURS"}{draw.draw_type === "global" ? " · ÉCOUTE GLOBALE" : ""}
        </span>
        <span>
          {rows.length} emplacement{rows.length > 1 ? "s" : ""}
        </span>
        <div className="draw-heading__actions">
          {editableEntry && <button type="button" className="sheet-entry-action" onClick={() => onOpenReview(editableEntry.id)}>Modifier mes notes</button>}
        </div>
      </div>
      <div className="sheet-scroll" ref={scrollRef}>
        <table className="sheet-table" ref={tableRef}>
          <thead>
            <HeaderRow />
          </thead>
          <tbody>
            {rows.map((entry) => {
              const review = reviews.get(entry.id);
              const bonus = bonusReviews.get(entry.id) ?? [];
              const canPropose =
                member &&
                assigned(entry, member, "proposer") &&
                emptySlot(entry) &&
                draw.status === "published";
              const canReview =
                member &&
                assigned(entry, member, "listener") &&
                !emptySlot(entry) &&
                (draw.status === "published" || (draw.status === "locked" && Boolean(review)));
              const archivedAlbum = archivedAlbums.find((album) =>
                sameAlbum(entry, album),
              );
              const previewCover = previewCoverUrl(entry, archivedAlbum);
              return (
                <tr
                  className={[
                    canPropose || canReview ? "sheet-row--action" : "",
                    entry.id === focusEntryId ? "sheet-row--focused" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  id={`draw-entry-${entry.id}`}
                  key={entry.id}
                  onClick={() =>
                    canPropose
                      ? onOpenProposal(entry.id)
                      : canReview
                        ? onOpenReview(entry.id)
                        : undefined
                  }
                >
                  <td>
                    {entry.album_title ? (
                      <span className="sheet-album-link">
                        {archivedAlbum ? (
                          <AlbumTitlePreview
                            href={`/albums/${archivedAlbum.slug}`}
                            title={entry.album_title}
                            artist={entry.album_artist}
                            cover={previewCover}
                            label={archiveLabel(entry)}
                          />
                        ) : (
                          <AlbumTitlePreview
                            href={`/albums/live-${entry.id}`}
                            title={entry.album_title}
                            artist={entry.album_artist}
                            cover={previewCover}
                            label={archiveLabel(entry)}
                          />
                        )}
                        <span>{entry.album_artist}</span>
                      </span>
                    ) : (
                      <span className="sheet-placeholder-album">
                        Album – Artiste
                      </span>
                    )}
                  {bonus.length > 0 && <details open className="sheet-bonus-reviews" onClick={(event) => event.stopPropagation()}><summary>{"\u00c9coutes bonus"} ({bonus.length}) · {bonus.map((bonusReview) => bonusReview.member_display_name || bonusReview.member_username).join(", ")}</summary>{bonus.map((bonusReview) => <article key={`${bonusReview.entry_id}:${bonusReview.member_username}`}><div><MemberProfileLink name={bonusReview.member_display_name || bonusReview.member_username} /><RatingDisplay rating={bonusReview.rating} /></div><ReviewPreview title={bonusReview.review_title} review={bonusReview.review} /></article>)}</details>}
                  </td>
                  <td><MemberProfileLink name={entry.proposed_by_name} /></td>
                  <td><MemberProfileLink name={entry.listened_by_name} /></td>
                  <td className="sheet-review">
                    <ReviewPreview title={review?.review_title} review={review?.review} />
                  </td>
                  <td>
                    {review ? (
                      <RatingDisplay rating={review.rating} />
                    ) : (
                      <span className="sheet-pending">En attente</span>
                    )}
                  </td>
                  <td>
                    {review?.best_track ? (
                      <MusicTrackChoiceButton className="sheet-track-link sheet-track-link--best" title={review.best_track} artist={entry.album_artist ?? ""} albumTitle={entry.album_title ?? undefined} youtubeMusicUrl={review.best_track_youtube_music_url ?? youtubeMusicSearchUrl(review.best_track, entry.album_artist, entry.album_title)}>
                        {review.best_track}
                        <span>↗</span>
                      </MusicTrackChoiceButton>
                    ) : (
                      <span className="sheet-track-empty">—</span>
                    )}
                  </td>
                  <td>
                    {review?.worst_track ? (
                      <MusicTrackChoiceButton className="sheet-track-link sheet-track-link--worst" title={review.worst_track} artist={entry.album_artist ?? ""} albumTitle={entry.album_title ?? undefined} youtubeMusicUrl={review.worst_track_youtube_music_url ?? youtubeMusicSearchUrl(review.worst_track, entry.album_artist, entry.album_title)}>
                        {review.worst_track}
                        <span>↗</span>
                      </MusicTrackChoiceButton>
                    ) : (
                      <span className="sheet-track-empty">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LiveDraws({
  entries,
  reviews,
  bonusReviews,
  draws,
  member,
  onOpenProposal,
  onOpenReview,
  focusEntryId = null,
}: {
  entries: Entry[];
  reviews: Review[];
  bonusReviews: BonusReview[];
  draws: Draw[];
  member: Member | null;
  onOpenProposal: (id: string) => void;
  onOpenReview: (id: string) => void;
  focusEntryId?: string | null;
}) {
  const reviewMap = new Map(reviews.map((review) => [review.album_id, review]));
  const bonusReviewMap = new Map<string, BonusReview[]>();
  for (const review of bonusReviews) { if (review.entry_id) bonusReviewMap.set(review.entry_id, [...(bonusReviewMap.get(review.entry_id) ?? []), review]); }
  return (
    <>
      {draws
        .filter((draw) => draw.status !== "draft")
        .sort((a, b) => b.draw_number - a.draw_number)
        .map((draw) => (
          <LiveDraw
            draw={draw}
            key={draw.draw_number}
            member={member}
            onOpenProposal={onOpenProposal}
            onOpenReview={onOpenReview}
            focusEntryId={focusEntryId}
            reviews={reviewMap}
            bonusReviews={bonusReviewMap}
            rows={entries
              .filter((entry) => entry.draw_number === draw.draw_number)
              .sort((a, b) => a.position - b.position)}
          />
        ))}
    </>
  );
}
