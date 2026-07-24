"use client";

import { useEffect, useState } from "react";
import { MusicTrackChoiceButton } from "@/components/music-player";
import { decodeHtmlEntities } from "@/lib/html-entities";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { youtubeMusicSearchUrl } from "@/lib/youtube-music";

type FavoriteTrack = {
  id: string;
  title: string;
  artist_name: string;
  cover_source_url: string | null;
};

export function MemberFavoriteTracks({ username }: { username: string | null }) {
  const configured = isSupabaseConfigured();
  const [tracks, setTracks] = useState<FavoriteTrack[]>([]);
  const [loaded, setLoaded] = useState(!configured || !username);

  useEffect(() => {
    if (!configured || !username) return;
    const supabase = getSupabaseBrowserClient();
    const load = async () => {
      const { data: profile } = await supabase
        .from("member_public_profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (!profile?.id) {
        setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("profile_favorite_tracks")
        .select("id, title, artist_name, cover_source_url")
        .eq("participant_id", profile.id)
        .order("display_order");
      setTracks((data ?? []) as FavoriteTrack[]);
      setLoaded(true);
    };
    void load();
    const channel = supabase
      .channel(`member-favorite-tracks-${username}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_favorite_tracks" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [configured, username]);

  if (!loaded) return null;
  return (
    <section className="profile-favorites profile-favorite-tracks" aria-labelledby="favorite-tracks-heading">
      <div className="member-archive__heading">
        <div>
          <p className="eyebrow">BANDE-SON PERSONNELLE</p>
          <h2 id="favorite-tracks-heading">{"Mes 3 musiques pr\u00e9f\u00e9r\u00e9es"}</h2>
        </div>
      </div>
      {tracks.length ? (
        <div className="profile-favorites__grid">
          {tracks.map((track) => {
            const title = decodeHtmlEntities(track.title);
            const artist = decodeHtmlEntities(track.artist_name);
            return (
              <article className="profile-favorite-card" key={track.id}>
                <MusicTrackChoiceButton className="profile-favorite-card__action" title={title} artist={artist} youtubeMusicUrl={youtubeMusicSearchUrl(title, artist)}>
                  <div className="profile-favorite-card__cover">
                    {track.cover_source_url ? <img src={track.cover_source_url} alt={`Jaquette de ${title} par ${artist}`} /> : <span aria-hidden="true">DOL<br />ZIKLUB</span>}
                  </div>
                  <h3>{title}</h3>
                  <p>{artist}</p>
                </MusicTrackChoiceButton>
              </article>
            );
          })}
        </div>
      ) : <p className="profile-favorites__empty">{"Aucune musique pr\u00e9f\u00e9r\u00e9e renseign\u00e9e pour le moment."}</p>}
    </section>
  );
}
