"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import {
  DeezerTrackLookup,
  type DeezerTrackCandidate,
} from "@/components/music-assist";
import { decodeHtmlEntities } from "@/lib/html-entities";
import type { ProfileThemeId } from "@/lib/profile-themes";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type FavoriteTrack = {
  id: string;
  title: string;
  artist: string;
  coverSourceUrl: string | null;
};
type FavoriteTrackRow = {
  id: string;
  title: string;
  artist_name: string;
  cover_source_url: string | null;
};

const makeTrack = (): FavoriteTrack => ({
  id: crypto.randomUUID(),
  title: "",
  artist: "",
  coverSourceUrl: null,
});

export function FavoriteTracksPanel({ theme }: { theme: ProfileThemeId }) {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<FavoriteTrack[]>([
    makeTrack(),
    makeTrack(),
    makeTrack(),
  ]);
  const [publishedIds, setPublishedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setMemberId(auth.user.id);

      const { data, error } = await supabase
        .from("profile_favorite_tracks")
        .select("id,title,artist_name,cover_source_url")
        .eq("participant_id", auth.user.id)
        .order("display_order");
      if (error) {
        setMessage(
          "Les musiques existantes n’ont pas pu être chargées. Réessaie dans un instant.",
        );
        return;
      }

      const saved = ((data ?? []) as FavoriteTrackRow[]).map((track) => ({
        id: track.id,
        title: decodeHtmlEntities(track.title),
        artist: decodeHtmlEntities(track.artist_name),
        coverSourceUrl: track.cover_source_url,
      }));
      setTracks(
        [
          ...saved,
          ...Array.from({ length: Math.max(0, 3 - saved.length) }, makeTrack),
        ].slice(0, 3),
      );
      setPublishedIds(saved.map((track) => track.id));
    };
    void load();
  }, []);

  const update = (index: number, values: Partial<FavoriteTrack>) =>
    setTracks((current) =>
      current.map((track, trackIndex) =>
        trackIndex === index ? { ...track, ...values } : track,
      ),
    );

  const remove = (index: number) => {
    update(index, makeTrack());
    setMessage("Musique retirée : enregistre pour publier la modification.");
  };

  const selectTrack = (
    index: number,
    candidate: DeezerTrackCandidate,
  ) => {
    update(index, {
      title: candidate.title,
      artist: candidate.artist,
      coverSourceUrl: candidate.coverUrl,
    });
    setMessage(
      "Morceau Deezer sélectionné : enregistre pour publier la modification.",
    );
  };

  const save = async () => {
    if (!memberId || saving) return;
    const complete = tracks.filter(
      (track) => track.title.trim() || track.artist.trim(),
    );
    if (
      complete.some((track) => !track.title.trim() || !track.artist.trim())
    ) {
      setMessage(
        "Chaque musique préférée doit avoir un titre et un artiste.",
      );
      return;
    }

    setSaving(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    const completeIds = new Set(complete.map((track) => track.id));
    const staleIds = publishedIds.filter((id) => !completeIds.has(id));

    if (staleIds.length) {
      const { error } = await supabase
        .from("profile_favorite_tracks")
        .delete()
        .in("id", staleIds);
      if (error) {
        setSaving(false);
        setMessage("Les anciennes musiques n’ont pas pu être retirées.");
        return;
      }
    }

    if (complete.length) {
      const { error } = await supabase
        .from("profile_favorite_tracks")
        .upsert(
          complete.map((track, index) => ({
            id: track.id,
            participant_id: memberId,
            title: decodeHtmlEntities(track.title.trim()),
            artist_name: decodeHtmlEntities(track.artist.trim()),
            cover_source_url: track.coverSourceUrl,
            display_order: index + 1,
          })),
          { onConflict: "id" },
        );
      if (error) {
        setSaving(false);
        setMessage(
          "La sauvegarde a échoué : tes sélections actuelles restent intactes.",
        );
        return;
      }
    }

    setPublishedIds(complete.map((track) => track.id));
    setSaving(false);
    setMessage("Musiques préférées enregistrées.");
  };

  return (
    <section
      className="favorite-albums-panel favorite-tracks-panel profile-theme"
      data-profile-theme={theme}
      aria-labelledby="favorite-tracks-panel-heading"
    >
      <header className="favorite-albums-panel__header">
        <p className="eyebrow">BANDE-SON PERSONNELLE</p>
        <h3 id="favorite-tracks-panel-heading">
          Mes 3 musiques préférées
        </h3>
        <p>
          Recherche un morceau sur Deezer, puis confirme le bon résultat. Le
          titre, l’artiste et la jaquette officielle ne changent jamais sans ton
          choix.
        </p>
      </header>

      <div className="favorite-albums-panel__grid">
        {tracks.map((track, index) => {
          const empty =
            !track.title && !track.artist && !track.coverSourceUrl;
          return (
            <article
              className="favorite-album-card favorite-track-card"
              key={track.id}
            >
              <div className="favorite-album-card__topline">
                <span>
                  <b>{index + 1}</b> Musique préférée n°{index + 1}
                </span>
                {!empty ? (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={saving}
                    aria-label={`Supprimer la musique préférée ${index + 1}`}
                  >
                    ×
                  </button>
                ) : null}
              </div>

              <div
                className={
                  empty
                    ? "favorite-album-card__cover is-empty"
                    : "favorite-album-card__cover"
                }
              >
                {track.coverSourceUrl ? (
                  <img
                    src={track.coverSourceUrl}
                    alt={`Jaquette de ${track.title || "la musique préférée"}`}
                  />
                ) : (
                  <div>
                    <strong>♪</strong>
                    <b>{empty ? "Ajoute ta musique" : "Choisis un morceau"}</b>
                    <small>
                      La jaquette sera récupérée après ton choix Deezer.
                    </small>
                  </div>
                )}
              </div>

              <div className="favorite-album-card__fields">
                <label>
                  Titre
                  <input
                    value={track.title}
                    disabled={saving}
                    maxLength={180}
                    placeholder="Nom du morceau…"
                    onChange={(event) =>
                      update(index, {
                        title: event.target.value,
                        coverSourceUrl: null,
                      })
                    }
                  />
                </label>
                <label>
                  Artiste
                  <input
                    value={track.artist}
                    disabled={saving}
                    maxLength={180}
                    placeholder="Nom de l’artiste…"
                    onChange={(event) =>
                      update(index, {
                        artist: event.target.value,
                        coverSourceUrl: null,
                      })
                    }
                  />
                </label>
                <DeezerTrackLookup
                  title={track.title}
                  artist={track.artist}
                  disabled={saving}
                  onSelect={(candidate) => selectTrack(index, candidate)}
                />
              </div>
            </article>
          );
        })}
      </div>

      <footer className="favorite-albums-panel__footer">
        <p>
          <b>♪</b>
          <span>
            Tes 3 morceaux seront affichés sur ton profil public.
            <small>
              Le visuel provient de la jaquette Deezer associée au résultat
              confirmé.
            </small>
          </span>
        </p>
        <div>
          <button
            className="button"
            type="button"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? "Enregistrement…" : "Enregistrer mes musiques"}
          </button>
          <small>Les modifications sont publiées après enregistrement.</small>
        </div>
      </footer>
      {message ? (
        <p className="account-message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
