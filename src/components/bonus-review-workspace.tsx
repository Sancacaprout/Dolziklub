"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { albums as archivedAlbums } from "@/data/albums";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { youtubeMusicSearchUrl } from "@/lib/youtube-music";
import type { Album } from "@/types/album";

type Entry = {
  id: string;
  draw_number: number;
  listened_by: string | null;
  album_title: string | null;
  album_artist: string | null;
  cover_path?: string | null;
  cover_source_url?: string | null;
  youtube_music_url?: string | null;
};
type PublicReview = { album_id: string; rating: number | null };
type BonusReview = {
  entry_id: string | null;
  archive_album_id: string | null;
  review_title: string | null;
  review: string;
  rating: number;
  best_track: string | null;
  worst_track: string | null;
};
type Candidate = {
  target: "entry" | "archive";
  id: string;
  drawNumber: number;
  archiveNumber: number | null;
  title: string;
  artist: string;
  coverUrl: string | null;
  albumUrl: string | null;
};
type ReviewPayload = {
  reviewTitle: string;
  review: string;
  rating: number;
  bestTrack: string;
  worstTrack: string;
};

const ratings = Array.from({ length: 11 }, (_, index) => index / 2);

function archiveNumber(album: Album) {
  const value = Number(album.id.replace("archive-", ""));
  return Number.isFinite(value) ? value : null;
}

function archivedDraw(number: number) {
  return number <= 10
    ? 1
    : number <= 19
      ? 2
      : number <= 28
        ? 3
        : number <= 36
          ? 4
          : number <= 45
            ? 5
            : 6;
}

function sameMember(
  first: string | null | undefined,
  second: string | null | undefined,
) {
  return Boolean(
    first &&
      second &&
      first.trim().toLocaleLowerCase() === second.trim().toLocaleLowerCase(),
  );
}

function candidateKey(candidate: Pick<Candidate, "target" | "id">) {
  return `${candidate.target}:${candidate.id}`;
}

function BonusReviewCard({
  candidate,
  existing,
  saving,
  onSave,
  onReset,
}: {
  candidate: Candidate;
  existing?: BonusReview;
  saving: boolean;
  onSave: (payload: ReviewPayload) => void;
  onReset: () => void;
}) {
  const [reviewTitle, setReviewTitle] = useState(existing?.review_title ?? "");
  const [review, setReview] = useState(existing?.review ?? "");
  const [rating, setRating] = useState(String(existing?.rating ?? ""));
  const [bestTrack, setBestTrack] = useState(existing?.best_track ?? "");
  const [worstTrack, setWorstTrack] = useState(existing?.worst_track ?? "");
  const albumUrl =
    candidate.albumUrl ?? youtubeMusicSearchUrl(candidate.artist, candidate.title);

  return (
    <article className="review-card">
      <div className="review-card__album">
        <span className="eyebrow">
          {existing ? "VERDICT ENREGISTRÉ" : "À RENDRE"}
        </span>
        <h3>
          <a href={albumUrl} target="_blank" rel="noopener noreferrer">
            {candidate.title}
            <span aria-hidden="true"> ↗</span>
          </a>
        </h3>
        <p>{candidate.artist}</p>
        {candidate.coverUrl ? (
          <Image
            unoptimized
            src={candidate.coverUrl}
            alt={`Pochette de ${candidate.title}`}
            width={220}
            height={220}
          />
        ) : null}
      </div>

      <form
        className="review-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            reviewTitle,
            review,
            rating: Number(rating),
            bestTrack,
            worstTrack,
          });
        }}
      >
        <label>
          <span>Titre de ton avis</span>
          <input
            required
            maxLength={160}
            value={reviewTitle}
            onChange={(event) => setReviewTitle(event.target.value)}
          />
        </label>
        <label className="review-form__opinion">
          <span>Ton avis</span>
          <textarea
            required
            maxLength={2000}
            value={review}
            onChange={(event) => setReview(event.target.value)}
          />
        </label>
        <label className="review-form__rating">
          <span>Ta note</span>
          <select
            required
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          >
            <option value="" disabled>
              Choisir une note
            </option>
            {ratings.map((choice) => (
              <option key={choice} value={choice}>
                {String(choice).replace(".", ",")} / 5
              </option>
            ))}
          </select>
        </label>
        <div className="review-form__tracks">
          <label>
            <span>Best track</span>
            <input
              maxLength={160}
              value={bestTrack}
              onChange={(event) => setBestTrack(event.target.value)}
            />
          </label>
          <label>
            <span>Worst track</span>
            <input
              maxLength={160}
              value={worstTrack}
              onChange={(event) => setWorstTrack(event.target.value)}
            />
          </label>
        </div>
        <div className="review-form__actions">
          <button type="submit" className="button" disabled={saving}>
            {saving
              ? "Enregistrement…"
              : existing
                ? "Mettre à jour mon verdict"
                : "Enregistrer mon verdict"}
          </button>
          {existing ? (
            <button
              type="button"
              className="sheet-entry-action review-form__reset"
              disabled={saving}
              onClick={() => {
                if (
                  window.confirm(
                    "Réinitialiser cet avis bonus ? Cette action supprimera son contenu.",
                  )
                ) {
                  onReset();
                }
              }}
            >
              Réinitialiser l’avis
            </button>
          ) : null}
        </div>
      </form>
    </article>
  );
}

function SavedBonusReview({
  candidate,
  review,
  saving,
  onSave,
  onReset,
}: {
  candidate: Candidate;
  review: BonusReview;
  saving: boolean;
  onSave: (payload: ReviewPayload) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="bonus-saved-review"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{open ? "−" : "+"}</span>
        <div>
          <b>{candidate.title}</b>
          <small>
            {candidate.artist} · {String(review.rating).replace(".", ",")} / 5
          </small>
        </div>
      </summary>
      {open ? (
        <BonusReviewCard
          key={`${candidateKey(candidate)}:${review.review}:${review.rating}`}
          candidate={candidate}
          existing={review}
          saving={saving}
          onSave={onSave}
          onReset={onReset}
        />
      ) : null}
    </details>
  );
}

export function BonusReviewWorkspace({
  albums = archivedAlbums,
  entries,
  publicReviews,
  member,
  onChanged,
}: {
  albums?: Album[];
  entries: Entry[];
  publicReviews: PublicReview[];
  member: { id: string; username: string; displayName: string };
  onChanged?: () => void;
}) {
  const configured = isSupabaseConfigured();
  const [drawNumber, setDrawNumber] = useState<number | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [reviews, setReviews] = useState<BonusReview[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const candidates = useMemo(() => {
    const reviewed = new Set(
      publicReviews
        .filter((review) => Number.isFinite(review.rating))
        .map((review) => review.album_id),
    );
    const live = entries
      .filter(
        (entry) =>
          entry.album_title?.trim() &&
          entry.album_artist?.trim() &&
          entry.listened_by !== member.id &&
          reviewed.has(entry.id),
      )
      .map((entry) => ({
        target: "entry" as const,
        id: entry.id,
        drawNumber: entry.draw_number,
        archiveNumber: null,
        title: entry.album_title!,
        artist: entry.album_artist!,
        coverUrl:
          entry.cover_path && configured
            ? getSupabaseBrowserClient().storage
                .from("album-covers")
                .getPublicUrl(entry.cover_path).data.publicUrl
            : (entry.cover_source_url ?? null),
        albumUrl: entry.youtube_music_url ?? null,
      }));

    const historic = albums
      .filter((album) => {
        const number = archiveNumber(album);
        return (
          number != null &&
          number <= 45 &&
          album.rating != null &&
          !sameMember(album.listenedBy, member.username) &&
          !sameMember(album.listenedBy, member.displayName)
        );
      })
      .map((album) => ({
        target: "archive" as const,
        id: album.id,
        drawNumber: archivedDraw(archiveNumber(album)!),
        archiveNumber: archiveNumber(album),
        title: album.title,
        artist: album.artist,
        coverUrl: album.cover,
        albumUrl: album.albumUrl,
      }));

    const unique = new Map<string, Candidate>();
    for (const candidate of [...live, ...historic]) {
      if (!unique.has(candidateKey(candidate))) {
        unique.set(candidateKey(candidate), candidate);
      }
    }
    return [...unique.values()].sort(
      (first, second) =>
        second.drawNumber - first.drawNumber ||
        `${first.artist} ${first.title}`.localeCompare(
          `${second.artist} ${second.title}`,
          "fr",
        ),
    );
  }, [
    albums,
    configured,
    entries,
    member.displayName,
    member.id,
    member.username,
    publicReviews,
  ]);

  const candidateMap = useMemo(
    () => new Map(candidates.map((candidate) => [candidateKey(candidate), candidate])),
    [candidates],
  );

  const allCandidates = useMemo(() => {
    const next = new Map(candidateMap);
    for (const review of reviews) {
      const target = review.entry_id ? "entry" : "archive";
      const id = review.entry_id ?? review.archive_album_id;
      if (!id || next.has(`${target}:${id}`)) continue;

      const entry =
        target === "entry" ? entries.find((item) => item.id === id) : null;
      const album =
        target === "archive" ? albums.find((item) => item.id === id) : null;
      if (entry?.album_title && entry.album_artist) {
        next.set(`${target}:${id}`, {
          target,
          id,
          drawNumber: entry.draw_number,
          archiveNumber: null,
          title: entry.album_title,
          artist: entry.album_artist,
          coverUrl: entry.cover_source_url ?? null,
          albumUrl: entry.youtube_music_url ?? null,
        });
      } else if (album) {
        next.set(`${target}:${id}`, {
          target,
          id,
          drawNumber: archivedDraw(archiveNumber(album) ?? 1),
          archiveNumber: archiveNumber(album),
          title: album.title,
          artist: album.artist,
          coverUrl: album.cover,
          albumUrl: album.albumUrl,
        });
      }
    }
    return next;
  }, [albums, candidateMap, entries, reviews]);

  const saved = useMemo(
    () =>
      reviews
        .map((review) => {
          const target = review.entry_id ? "entry" : "archive";
          const id = review.entry_id ?? review.archive_album_id;
          return id
            ? { review, candidate: allCandidates.get(`${target}:${id}`) }
            : null;
        })
        .filter(
          (
            value,
          ): value is { review: BonusReview; candidate: Candidate } =>
            Boolean(value?.candidate),
        )
        .sort(
          (first, second) =>
            second.candidate.drawNumber - first.candidate.drawNumber,
        ),
    [allCandidates, reviews],
  );

  const drawNumbers = useMemo(
    () =>
      [...new Set(candidates.map((candidate) => candidate.drawNumber))].sort(
        (first, second) => second - first,
      ),
    [candidates],
  );
  const activeDrawNumber = drawNumber ?? drawNumbers[0] ?? null;
  const drawCandidates = candidates.filter(
    (candidate) => candidate.drawNumber === activeDrawNumber,
  );
  const selected =
    drawCandidates.find((candidate) => candidateKey(candidate) === selectedKey) ??
    drawCandidates[0] ??
    null;
  const existing = selected
    ? reviews.find((review) =>
        selected.target === "entry"
          ? review.entry_id === selected.id
          : review.archive_album_id === selected.id,
      )
    : undefined;

  const loadReviews = useCallback(async () => {
    if (!configured) return;
    try {
      const { data, error } = await getSupabaseBrowserClient()
        .from("bonus_album_reviews")
        .select(
          "entry_id, archive_album_id, review_title, review, rating, best_track, worst_track",
        )
        .eq("member_id", member.id);
      if (!error) setReviews((data ?? []) as BonusReview[]);
    } catch {
      setMessage("Les avis bonus n’ont pas pu être chargés.");
    }
  }, [configured, member.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReviews(), 0);
    return () => window.clearTimeout(timer);
  }, [loadReviews]);

  const save = async (candidate: Candidate, payload: ReviewPayload) => {
    if (
      !configured ||
      !payload.review.trim() ||
      !Number.isInteger(payload.rating * 2)
    ) {
      return;
    }
    setSaving(true);
    setMessage("");
    const { error } = await getSupabaseBrowserClient().rpc(
      "save_my_bonus_album_review",
      {
        p_entry_id: candidate.target === "entry" ? candidate.id : null,
        p_archive_album_id:
          candidate.target === "archive" ? candidate.id : null,
        p_review_title: payload.reviewTitle.trim() || null,
        p_review: payload.review.trim(),
        p_rating: payload.rating,
        p_best_track: payload.bestTrack.trim() || null,
        p_worst_track: payload.worstTrack.trim() || null,
      },
    );
    setSaving(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Avis bonus enregistré.");
      await loadReviews();
      onChanged?.();
    }
  };

  const reset = async (candidate: Candidate) => {
    if (!configured) return;
    setSaving(true);
    const { error } = await getSupabaseBrowserClient().rpc(
      "reset_my_bonus_album_review",
      {
        p_entry_id: candidate.target === "entry" ? candidate.id : null,
        p_archive_album_id:
          candidate.target === "archive" ? candidate.id : null,
      },
    );
    setSaving(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Avis bonus réinitialisé.");
      await loadReviews();
      onChanged?.();
    }
  };

  return (
    <section
      id="bonus-review-workspace"
      className="review-workspace bonus-review-workspace"
      tabIndex={-1}
    >
      <div className="review-workspace__heading">
        <div>
          <p className="eyebrow">ÉCOUTES BONUS</p>
          <h2>
            Un album que je veux <em>écouter en plus.</em>
          </h2>
          <p>Choisis le tirage puis un album déjà noté par un autre membre.</p>
        </div>
      </div>

      {message ? (
        <p
          className={`selection-message bonus-review-message${message === "Avis bonus enregistré." ? " is-success" : ""}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}

      {saved.length ? (
        <section className="bonus-saved-reviews">
          <div className="review-workspace__heading">
            <div>
              <p className="eyebrow">MES AVIS BONUS</p>
              <h3>{saved.length} avis à modifier ou consulter.</h3>
            </div>
          </div>
          {saved.map(({ review, candidate }) => (
            <SavedBonusReview
              key={candidateKey(candidate)}
              candidate={candidate}
              review={review}
              saving={saving}
              onSave={(payload) => void save(candidate, payload)}
              onReset={() => void reset(candidate)}
            />
          ))}
        </section>
      ) : null}

      {candidates.length ? (
        <>
          <div className="bonus-review-workspace__pickers">
            <label className="bonus-review-workspace__picker">
              <span>Numéro du tirage</span>
              <select
                value={activeDrawNumber ?? ""}
                onChange={(event) => {
                  setDrawNumber(Number(event.target.value));
                  setSelectedKey("");
                }}
              >
                {drawNumbers.map((draw) => (
                  <option key={draw} value={draw}>
                    Tirage {String(draw).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </label>
            <label className="bonus-review-workspace__picker">
              <span>Album du tirage</span>
              <select
                value={selected ? candidateKey(selected) : ""}
                onChange={(event) => setSelectedKey(event.target.value)}
              >
                {drawCandidates.map((candidate) => (
                  <option
                    key={candidateKey(candidate)}
                    value={candidateKey(candidate)}
                  >
                    {candidate.title} - {candidate.artist}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selected ? (
            <div className="review-queue">
              <BonusReviewCard
                key={`${candidateKey(selected)}:${existing?.review ?? ""}:${existing?.rating ?? ""}`}
                candidate={selected}
                existing={existing}
                saving={saving}
                onSave={(payload) => void save(selected, payload)}
                onReset={() => void reset(selected)}
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className="review-workspace__empty">
          <p>Aucun album noté par un autre membre n’est disponible.</p>
        </div>
      )}
    </section>
  );
}
