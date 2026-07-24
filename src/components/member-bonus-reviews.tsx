"use client";

import { useEffect, useMemo, useState } from "react";
import { RatingDisplay } from "@/components/rating-display";
import { ReviewPreview } from "@/components/review-preview";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Album } from "@/types/album";

type BonusReview = {
  entry_id: string | null;
  archive_album_id: string | null;
  draw_number: number | null;
  archive_number: number | null;
  album_title: string | null;
  album_artist: string | null;
  cover_path: string | null;
  cover_source_url: string | null;
  member_username: string;
  member_display_name: string;
  review_title: string | null;
  review: string;
  rating: number;
};

function storedCoverUrl(path: string | null) {
  if (!path || !isSupabaseConfigured()) return null;
  try {
    return getSupabaseBrowserClient().storage.from("album-covers").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

export function MemberBonusReviews({ username, albums = [] }: { username: string | null; albums?: Album[] }) {
  const configured = isSupabaseConfigured();
  const [reviews, setReviews] = useState<BonusReview[]>([]);
  const [loaded, setLoaded] = useState(!configured || !username);

  useEffect(() => {
    if (!configured || !username) return;
    let active = true;
    const load = async () => {
      try {
        const { data, error } = await getSupabaseBrowserClient().rpc("get_public_bonus_draw_reviews");
        if (!error && active) setReviews(((data ?? []) as BonusReview[]).filter((review) => review.member_username.toLocaleLowerCase() === username.toLocaleLowerCase()));
      } catch {
        // Bonus reviews must never prevent the profile from rendering.
      } finally {
        if (active) setLoaded(true);
      }
    };
    void load();
    return () => { active = false; };
  }, [configured, username]);

  const archiveMap = useMemo(() => new Map(albums.map((album) => [album.id, album])), [albums]);
  const ordered = useMemo(() => [...reviews].sort((first, second) => (second.draw_number ?? 0) - (first.draw_number ?? 0)), [reviews]);
  if (!loaded || !ordered.length) return null;

  return <section className="member-archive member-bonus-reviews"><div className="member-archive__heading"><div><p className="eyebrow">{"\u00c9COUTES BONUS"}</p><h2>{"Albums \u00e9cout\u00e9s en bonus."}</h2></div><small>Hors statistiques du club</small></div><div className="member-bonus-reviews__list">{ordered.map((review) => {
    const archive = review.archive_album_id ? archiveMap.get(review.archive_album_id) : null;
    const title = review.album_title ?? archive?.title ?? "Album archive";
    const artist = review.album_artist ?? archive?.artist ?? "";
    const coverUrl = storedCoverUrl(review.cover_path) ?? review.cover_source_url ?? archive?.cover ?? null;
    return <article key={`${review.entry_id ?? review.archive_album_id}:${review.member_username}`} className="member-bonus-review"><div className="member-bonus-review__cover">{coverUrl ? <img src={coverUrl} alt={`Pochette de ${title}`} /> : <span aria-hidden="true">DOL<br />ZIKLUB</span>}</div><div className="member-bonus-review__main"><span className="eyebrow">{review.archive_number == null ? `TIRAGE ${String(review.draw_number ?? 0).padStart(2, "0")}` : `ARCHIVE #${review.archive_number} - TIRAGE ${String(review.draw_number ?? 0).padStart(2, "0")}`}</span><h3>{title}</h3><p>{artist}</p><div className="member-bonus-review__verdict"><ReviewPreview title={review.review_title} review={review.review} /></div></div><RatingDisplay rating={review.rating} /></article>;
  })}</div></section>;
}