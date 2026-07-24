"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import type { ProfileThemeId } from "@/lib/profile-themes";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Rank = 1 | 2 | 3;
type ArtistDraft = {
  id: string;
  rank: Rank;
  name: string;
  deezerArtistId: number | null;
  deezerUrl: string | null;
  imagePath: string | null;
  imageUrl: string | null;
};
type ArtistRow = {
  id: string;
  rank: Rank;
  artist_name: string;
  deezer_artist_id: number | null;
  deezer_url: string | null;
  image_path: string | null;
  image_url: string | null;
};
type ArtistCandidate = {
  id: string;
  name: string;
  imageUrl: string | null;
  deezerUrl: string;
  type: "artist";
};

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const visualRanks: Rank[] = [2, 1, 3];
const medalSymbols: Record<Rank, string> = { 1: "★", 2: "●", 3: "◆" };

function emptyArtist(rank: Rank): ArtistDraft {
  return {
    id: crypto.randomUUID(),
    rank,
    name: "",
    deezerArtistId: null,
    deezerUrl: null,
    imagePath: null,
    imageUrl: null,
  };
}

function normalizedArtistName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function storedImage(path: string | null, url: string | null) {
  if (path) {
    return getSupabaseBrowserClient()
      .storage.from("profile-favorites")
      .getPublicUrl(path).data.publicUrl;
  }
  return url;
}

export function FavoriteArtistsPanel({ theme }: { theme: ProfileThemeId }) {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [artists, setArtists] = useState<ArtistDraft[]>([
    emptyArtist(1),
    emptyArtist(2),
    emptyArtist(3),
  ]);
  const [publishedIds, setPublishedIds] = useState<string[]>([]);
  const [results, setResults] = useState<Record<number, ArtistCandidate[]>>({});
  const [searchingRank, setSearchingRank] = useState<Rank | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setMemberId(auth.user.id);
      const { data, error } = await supabase
        .from("profile_favorite_artists")
        .select("id,rank,artist_name,deezer_artist_id,deezer_url,image_path,image_url")
        .eq("participant_id", auth.user.id)
        .order("rank");
      if (error) {
        setMessage("Les artistes existants n’ont pas pu être chargés.");
        return;
      }
      const saved = (data ?? []) as ArtistRow[];
      const byRank = new Map(saved.map((artist) => [artist.rank, artist]));
      setArtists(([1, 2, 3] as Rank[]).map((rank) => {
        const artist = byRank.get(rank);
        return artist ? {
          id: artist.id,
          rank,
          name: artist.artist_name,
          deezerArtistId: artist.deezer_artist_id,
          deezerUrl: artist.deezer_url,
          imagePath: artist.image_path,
          imageUrl: artist.image_url,
        } : emptyArtist(rank);
      }));
      setPublishedIds(saved.map((artist) => artist.id));
    };
    void load();
  }, []);

  const artistAt = (rank: Rank) => artists.find((artist) => artist.rank === rank)!;
  const update = (rank: Rank, values: Partial<ArtistDraft>) => {
    setArtists((current) => current.map((artist) =>
      artist.rank === rank ? { ...artist, ...values, rank } : artist,
    ));
  };
  const remove = (rank: Rank) => {
    update(rank, emptyArtist(rank));
    setResults((current) => ({ ...current, [rank]: [] }));
    setMessage("Artiste retiré : enregistre pour publier la modification.");
  };

  const search = async (artist: ArtistDraft) => {
    if (!artist.name.trim()) {
      setMessage("Écris le nom de l’artiste avant de lancer la recherche.");
      return;
    }
    setSearchingRank(artist.rank);
    setMessage("");
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!data.session?.access_token) throw new Error("Reconnecte-toi pour utiliser Deezer.");
      const response = await fetch("/api/music/search-artists", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + data.session.access_token,
        },
        body: JSON.stringify({ artist: artist.name }),
      });
      const payload = await response.json().catch(() => ({})) as {
        candidates?: ArtistCandidate[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "La recherche Deezer est indisponible.");
      const candidates = (payload.candidates ?? []).filter((candidate) => candidate.type === "artist");
      setResults((current) => ({ ...current, [artist.rank]: candidates }));
      setMessage(candidates.length
        ? "Choisis l’artiste Deezer qui correspond."
        : "Aucun artiste Deezer correspondant n’a été trouvé.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "La recherche Deezer est indisponible.");
    } finally {
      setSearchingRank(null);
    }
  };

  const selectCandidate = (rank: Rank, candidate: ArtistCandidate) => {
    update(rank, {
      name: candidate.name,
      deezerArtistId: Number(candidate.id),
      deezerUrl: candidate.deezerUrl,
      imagePath: null,
      imageUrl: candidate.imageUrl,
    });
    setResults((current) => ({ ...current, [rank]: [] }));
  };

  const uploadPortrait = async (rank: Rank, file: File | null) => {
    if (!memberId || !file) return;
    if (!imageTypes.has(file.type) || file.size > 3 * 1024 * 1024) {
      setMessage("Choisis une image JPG, PNG ou WebP de 3 Mo maximum.");
      return;
    }
    const artist = artistAt(rank);
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = memberId + "/" + artist.id + "/artist." + extension;
    const { error } = await getSupabaseBrowserClient()
      .storage.from("profile-favorites")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "31536000",
      });
    if (error) {
      setMessage("La photo de l’artiste n’a pas pu être importée.");
      return;
    }
    update(rank, { imagePath: path, imageUrl: null });
    setMessage("Photo remplacée : enregistre pour la publier.");
  };

  const save = async () => {
    if (!memberId || saving) return;
    const complete = artists.filter((artist) => artist.name.trim());
    const deezerIds = complete
      .map((artist) => artist.deezerArtistId)
      .filter((id): id is number => id !== null);
    const names = complete.map((artist) => normalizedArtistName(artist.name));
    if (new Set(deezerIds).size !== deezerIds.length || new Set(names).size !== names.length) {
      setMessage("Cet artiste est déjà présent dans ton podium.");
      return;
    }
    if (complete.some((artist) => artist.imageUrl && !artist.imageUrl.startsWith("https://"))) {
      setMessage("La photo externe de l’artiste doit utiliser HTTPS.");
      return;
    }

    setSaving(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (complete.length) {
      const { error } = await supabase.from("profile_favorite_artists").upsert(
        complete.map((artist) => ({
          id: artist.id,
          participant_id: memberId,
          rank: artist.rank,
          artist_name: artist.name.trim(),
          deezer_artist_id: artist.deezerArtistId,
          deezer_url: artist.deezerUrl,
          image_path: artist.imagePath,
          image_url: artist.imageUrl,
        })),
        { onConflict: "id" },
      );
      if (error) {
        setSaving(false);
        setMessage(error.code === "23505"
          ? "Cet artiste est déjà présent dans ton podium."
          : "La sauvegarde a échoué : tes artistes actuels restent intacts.");
        return;
      }
    }
    const completeIds = new Set(complete.map((artist) => artist.id));
    const staleIds = publishedIds.filter((id) => !completeIds.has(id));
    if (staleIds.length) {
      const { error } = await supabase
        .from("profile_favorite_artists")
        .delete()
        .in("id", staleIds);
      if (error) {
        setSaving(false);
        setMessage("Les anciens artistes n’ont pas pu être retirés.");
        return;
      }
    }
    setPublishedIds(complete.map((artist) => artist.id));
    setSaving(false);
    setMessage("Podium d’artistes enregistré.");
  };

  return (
    <section
      className="favorite-albums-panel favorite-artists-panel profile-theme"
      data-profile-theme={theme}
      aria-labelledby="favorite-artists-panel-heading"
    >
      <header className="favorite-albums-panel__header">
        <p className="eyebrow">PODIUM PERSONNEL</p>
        <h3 id="favorite-artists-panel-heading">Mes 3 artistes préférés</h3>
        <p>Recherche uniquement des artistes sur Deezer, puis confirme chaque place de ton podium.</p>
      </header>
      <div className="favorite-artists-editor">
        {visualRanks.map((rank) => {
          const artist = artistAt(rank);
          const image = storedImage(artist.imagePath, artist.imageUrl);
          return (
            <article className={"favorite-artist-editor-card favorite-artist-editor-card--rank-" + rank} key={rank}>
              <div className="favorite-album-card__topline">
                <span><b>{rank}</b><i aria-label={"Médaille du top " + rank}>{medalSymbols[rank]}</i> TOP {rank}</span>
                {artist.name ? (
                  <button type="button" onClick={() => remove(rank)} disabled={saving} aria-label={"Supprimer l’artiste du top " + rank}>×</button>
                ) : null}
              </div>
              <div className="favorite-artist-editor-card__portrait">
                {image ? <img src={image} alt={"Portrait de " + artist.name} /> : <span aria-hidden="true">ARTISTE<br />À CHOISIR</span>}
              </div>
              <label>
                Nom de l’artiste
                <input
                  value={artist.name}
                  maxLength={180}
                  disabled={saving}
                  onChange={(event) => update(rank, { name: event.target.value })}
                />
              </label>
              <div className="favorite-track-search">
                <button
                  className="favorite-album-card__outline-button"
                  type="button"
                  disabled={saving || searchingRank === rank}
                  onClick={() => void search(artist)}
                >
                  {searchingRank === rank ? "Recherche Deezer…" : "Rechercher sur Deezer"}
                </button>
                {(results[rank] ?? []).map((candidate) => (
                  <button
                    className="favorite-track-search__result"
                    type="button"
                    key={candidate.id}
                    onClick={() => selectCandidate(rank, candidate)}
                  >
                    {candidate.imageUrl ? <img src={candidate.imageUrl} alt="" /> : null}
                    <span><b>{candidate.name}</b><small>Artiste Deezer</small></span>
                    <em>Choisir</em>
                  </button>
                ))}
              </div>
              <label className="favorite-artist-editor-card__upload text-link">
                Remplacer la photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={saving}
                  onChange={(event) => void uploadPortrait(rank, event.target.files?.[0] ?? null)}
                />
              </label>
            </article>
          );
        })}
      </div>
      <footer className="favorite-albums-panel__footer">
        <p><b>★</b><span>TOP 1 au centre, TOP 2 à gauche, TOP 3 à droite.<small>Sur mobile, le podium passe dans l’ordre 1, 2, 3.</small></span></p>
        <div>
          <button className="button" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer mes artistes"}
          </button>
          <small>Les modifications sont publiées après enregistrement.</small>
        </div>
      </footer>
      {message ? <p className="account-message" role="status">{message}</p> : null}
    </section>
  );
}
