"use client";

/* eslint-disable @next/next/no-img-element */
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type FavoriteArtist = {
  id: string;
  rank: 1 | 2 | 3;
  artist_name: string;
  deezer_artist_id: number | null;
  deezer_url: string | null;
  image_path: string | null;
  image_url: string | null;
};

const medals = {
  1: { symbol: "★", label: "médaille d’or" },
  2: { symbol: "●", label: "médaille d’argent" },
  3: { symbol: "◆", label: "médaille de bronze" },
} as const;

function artistImage(artist: FavoriteArtist) {
  if (artist.image_path) {
    return getSupabaseBrowserClient()
      .storage.from("profile-favorites")
      .getPublicUrl(artist.image_path).data.publicUrl;
  }
  return artist.image_url;
}

export function FavoriteArtistsPodium({
  artists,
  headingId = "favorite-artists-heading",
}: {
  artists: FavoriteArtist[];
  headingId?: string;
}) {
  if (!artists.length) return null;
  const byRank = new Map(artists.map((artist) => [artist.rank, artist]));
  const visible = [2, 1, 3]
    .map((rank) => byRank.get(rank as 1 | 2 | 3))
    .filter((artist): artist is FavoriteArtist => Boolean(artist));

  return (
    <section className="profile-favorites profile-favorite-artists" aria-labelledby={headingId}>
      <div className="member-archive__heading">
        <div>
          <p className="eyebrow">PODIUM PERSONNEL</p>
          <h2 id={headingId}>Mes 3 artistes préférés</h2>
        </div>
      </div>
      <div className="favorite-artists-podium">
        {visible.map((artist) => {
          const image = artistImage(artist);
          const body = (
            <>
              <span className="favorite-artist-card__rank">
                <i aria-label={medals[artist.rank].label}>{medals[artist.rank].symbol}</i>
                TOP {artist.rank}
              </span>
              <div className="favorite-artist-card__portrait">
                {image ? (
                  <img src={image} alt={"Portrait de " + artist.artist_name} />
                ) : (
                  <span aria-hidden="true">{artist.artist_name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <h3>{artist.artist_name}</h3>
              {artist.deezer_url ? <small>Ouvrir sur Deezer ↗</small> : null}
            </>
          );
          return (
            <article
              className={"favorite-artist-card favorite-artist-card--rank-" + artist.rank}
              key={artist.id}
              data-rank={artist.rank}
            >
              {artist.deezer_url ? (
                <a href={artist.deezer_url} target="_blank" rel="noreferrer">
                  {body}
                </a>
              ) : body}
            </article>
          );
        })}
      </div>
    </section>
  );
}
