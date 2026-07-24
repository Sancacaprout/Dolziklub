"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { AlbumLookup } from "@/components/music-assist";
import type { MusicCandidate } from "@/lib/music-matching";
import type { ProfileThemeId } from "@/lib/profile-themes";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Favorite = {
  id: string;
  title: string;
  artist: string;
  coverPath: string | null;
  coverSourceUrl: string | null;
};
type FavoriteRow = {
  id: string;
  title: string;
  artist_name: string;
  cover_path: string | null;
  cover_source_url: string | null;
};

const makeFavorite = (): Favorite => ({
  id: crypto.randomUUID(),
  title: "",
  artist: "",
  coverPath: null,
  coverSourceUrl: null,
});
function coverUrl(favorite: Favorite) {
  return favorite.coverPath
    ? getSupabaseBrowserClient().storage
        .from("profile-favorites")
        .getPublicUrl(favorite.coverPath).data.publicUrl
    : favorite.coverSourceUrl;
}

export function FavoriteAlbumsPanel({ theme }: { theme: ProfileThemeId }) {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([
    makeFavorite(),
    makeFavorite(),
    makeFavorite(),
  ]);
  const [publishedIds, setPublishedIds] = useState<string[]>([]);
  const [publishedPaths, setPublishedPaths] = useState<string[]>([]);
  const [pendingCleanup, setPendingCleanup] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Record<string, MusicCandidate | null>>({});

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setMemberId(auth.user.id);
      const { data, error } = await supabase
        .from("profile_favorite_albums")
        .select("id,title,artist_name,cover_path,cover_source_url")
        .eq("participant_id", auth.user.id)
        .order("display_order");
      if (error) {
        setMessage("Les albums existants n’ont pas pu être chargés. Réessaie dans un instant.");
        return;
      }
      const saved = ((data ?? []) as FavoriteRow[]).map((item) => ({
        id: item.id,
        title: item.title,
        artist: item.artist_name,
        coverPath: item.cover_path,
        coverSourceUrl: item.cover_source_url,
      }));
      setFavorites(
        [...saved, ...Array.from({ length: Math.max(0, 3 - saved.length) }, makeFavorite)].slice(0, 3),
      );
      setPublishedIds(saved.map((item) => item.id));
      setPublishedPaths(
        saved.flatMap((item) => item.coverPath ? [item.coverPath] : []),
      );
    };
    void load();
  }, []);

  const update = (index: number, next: Partial<Favorite>) =>
    setFavorites((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...next } : item,
      ),
    );

  const queueOldCoverForCleanup = (path: string | null) => {
    if (!path) return;
    if (publishedPaths.includes(path)) {
      setPendingCleanup((current) => current.includes(path) ? current : [...current, path]);
    } else {
      void getSupabaseBrowserClient().storage.from("profile-favorites").remove([path]);
    }
  };

  const selectAlbum = (index: number, candidate: MusicCandidate | null) => {
    const favorite = favorites[index];
    setSelectedMatches((current) => ({ ...current, [favorite.id]: candidate }));
    if (!candidate) {
      update(index, { coverSourceUrl: null });
      return;
    }
    queueOldCoverForCleanup(favorite.coverPath);
    update(index, {
      title: candidate.title,
      artist: candidate.artist,
      coverPath: null,
      coverSourceUrl: candidate.thumbnailUrl ?? null,
    });
  };

  const remove = (index: number) => {
    const favorite = favorites[index];
    queueOldCoverForCleanup(favorite.coverPath);
    update(index, makeFavorite());
    setMessage("Album retiré : enregistre pour publier la modification.");
  };


  const save = async () => {
    if (!memberId || saving) return;
    const complete = favorites.filter((item) => item.title.trim() || item.artist.trim());
    if (complete.some((item) => !item.title.trim() || !item.artist.trim())) {
      setMessage("Chaque album favori doit avoir un titre et un artiste.");
      return;
    }
    setSaving(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    const completeIds = new Set(complete.map((item) => item.id));
    const staleIds = publishedIds.filter((id) => !completeIds.has(id));
    if (staleIds.length) {
      const { error: deleteError } = await supabase
        .from("profile_favorite_albums")
        .delete()
        .in("id", staleIds);
      if (deleteError) {
        setSaving(false);
        setMessage("Les anciens albums n’ont pas pu être retirés. Rien n’a été écrasé.");
        return;
      }
    }
    if (complete.length) {
      const { error: upsertError } = await supabase
        .from("profile_favorite_albums")
        .upsert(
          complete.map((item, index) => ({
            id: item.id,
            participant_id: memberId,
            title: item.title.trim(),
            artist_name: item.artist.trim(),
            cover_path: item.coverPath,
            cover_source_url: item.coverSourceUrl,
            source_catalog_key: null,
            display_order: index + 1,
          })),
          { onConflict: "id" },
        );
      if (upsertError) {
        setSaving(false);
        setMessage("La sauvegarde a échoué : tes jaquettes actuelles restent intactes.");
        return;
      }
    }
    const activePaths = new Set(
      complete.flatMap((item) => item.coverPath ? [item.coverPath] : []),
    );
    const pathsToRemove = pendingCleanup.filter((path) => !activePaths.has(path));
    if (pathsToRemove.length) {
      await supabase.storage.from("profile-favorites").remove(pathsToRemove);
    }
    setPublishedIds(complete.map((item) => item.id));
    setPublishedPaths([...activePaths]);
    setPendingCleanup([]);
    setSaving(false);
    setMessage("Albums favoris enregistrés.");
  };

  return (
    <section
      className="favorite-albums-panel favorite-editor profile-theme"
      data-profile-theme={theme}
      aria-labelledby="favorite-albums-panel-heading"
    >
      <header className="favorite-albums-panel__header">
        <p className="eyebrow">COLLECTION PERSONNELLE</p>
        <h3 id="favorite-albums-panel-heading">Mes 3 albums préférés</h3>
        <p>Recherche tes albums sur Deezer pour récupérer leur jaquette officielle.</p>
      </header>
      <div className="favorite-albums-panel__grid">
        {favorites.map((favorite, index) => {
          const cover = coverUrl(favorite);
          const isEmpty = !favorite.title && !favorite.artist && !cover;
          return (
            <article className="favorite-album-card" key={favorite.id}>
              <div className="favorite-album-card__topline">
                <span><b>{index + 1}</b> Album favori n°{index + 1}</span>
                {!isEmpty ? <button type="button" onClick={() => remove(index)} disabled={saving} aria-label={`Supprimer l’album favori ${index + 1}`}>⌫</button> : null}
              </div>
              <div className={isEmpty ? "favorite-album-card__cover is-empty" : "favorite-album-card__cover"}>
                {cover ? <img key={cover} src={cover} alt={`Jaquette de ${favorite.title || "l’album favori"}`} /> : <div><strong>◉</strong><b>{isEmpty ? "Ajoute ton album" : "Choisis-le sur Deezer"}</b><small>La jaquette officielle apparaîtra après ton choix.</small></div>}
              </div>
              <div className="favorite-album-card__fields">
                <label>
                  Titre
                  <input
                    value={favorite.title}
                    disabled={saving}
                    maxLength={180}
                    placeholder="Nom de l’album…"
                    onChange={(event) => {
                      setSelectedMatches((current) => ({ ...current, [favorite.id]: null }));
                      update(index, { title: event.target.value });
                    }}
                  />
                </label>
                <label>
                  Artiste
                  <input
                    value={favorite.artist}
                    disabled={saving}
                    maxLength={180}
                    placeholder="Nom de l’artiste…"
                    onChange={(event) => {
                      setSelectedMatches((current) => ({ ...current, [favorite.id]: null }));
                      update(index, { artist: event.target.value });
                    }}
                  />
                </label>
                <AlbumLookup
                  title={favorite.title}
                  artist={favorite.artist}
                  selected={selectedMatches[favorite.id] ?? null}
                  disabled={saving}
                  automatic={false}
                  onSelect={(candidate) => selectAlbum(index, candidate)}
                />
              </div>
            </article>
          );
        })}
      </div>
      <footer className="favorite-albums-panel__footer">
        <p><b>☆</b><span>Tes 3 albums seront affichés sur ton profil public.<small>La jaquette officielle est récupérée automatiquement depuis Deezer.</small></span></p>
        <div><button className="button" type="button" onClick={() => void save()} disabled={saving}>{saving ? "Enregistrement…" : "▣ Enregistrer mes albums"}</button><small>Les modifications sont publiées après enregistrement.</small></div>
      </footer>
      {message ? <p className="account-message" role="status">{message}</p> : null}
    </section>
  );
}