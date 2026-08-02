import Image from "next/image";
import { MusicTrackChoiceButton } from "@/components/music-player";
import { RatingDisplay } from "@/components/rating-display";
import { youtubeMusicSearchUrl } from "@/lib/youtube-music";

type Track = { title: string | null; url: string | null };

function avatarUrl(path: string | null) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base || !path) return null;
  return `${base}/storage/v1/object/public/member-avatars/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function AlbumVerdict({
  reviewer,
  avatarPath = null,
  rating,
  reviewTitle,
  reviewDetail,
  bestTrack,
  worstTrack,
  artist,
  albumTitle,
  submittedAt = null,
}: {
  reviewer: string;
  avatarPath?: string | null;
  rating: number | null;
  reviewTitle: string | null;
  reviewDetail: string | null;
  bestTrack: Track;
  worstTrack: Track;
  artist: string;
  albumTitle: string;
  submittedAt?: string | null;
}) {
  const avatar = avatarUrl(avatarPath);
  const trackLink = (track: Track) => track.title
    ? track.url ?? youtubeMusicSearchUrl(track.title, artist, albumTitle)
    : null;
  const submitted = submittedAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(submittedAt))
    : null;

  return <section className="review-sheet" data-reviewer={reviewer.toLowerCase()}>
    <div className="review-quote">
      {avatar && <Image className="member-card__avatar" unoptimized src={avatar} alt={`Avatar de ${reviewer}`} width={70} height={70} />}
      <p className="eyebrow">VERDICT DE {reviewer.toUpperCase()}</p>
      <RatingDisplay rating={rating} />
      <blockquote>{reviewTitle ?? "Le compte rendu est encore sous scellés."}</blockquote>
      {reviewDetail && <p className="review-detail">{reviewDetail}</p>}
      <p className="eyebrow">{submitted ? `RENDU LE ${submitted.toUpperCase()}` : "AVIS EN ATTENTE"}</p>
    </div>
    <div className="track-box">
      {([["best", bestTrack], ["worst", worstTrack]] as const).map(([kind, track]) => {
        const url = trackLink(track);
        return <div className={`track-card track-card--${kind}`} key={kind}>
          <span>{kind === "best" ? "Best track" : "Worst track"}</span>
          {track.title && url ? <MusicTrackChoiceButton
            title={track.title}
            artist={artist}
            albumTitle={albumTitle}
            youtubeMusicUrl={url}
          >
            {track.title}
            <small>Écouter sur YouTube Music ↗</small>
          </MusicTrackChoiceButton> : <p>Pas encore renseigné</p>}
        </div>;
      })}
    </div>
  </section>;
}
