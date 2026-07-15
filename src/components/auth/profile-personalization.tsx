"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import {
  defaultProfileTheme,
  profileThemes,
  type ProfileThemeId,
} from "@/lib/profile-themes";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { ProfileThemePreview } from "@/components/profile-theme-preview";

type FavoriteDraft = {
  id: string | null;
  title: string;
  artistName: string;
  coverPath: string | null;
  coverSourceUrl: string | null;
};

type SearchCandidate = {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
};

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function emptyFavorite(): FavoriteDraft {
  return {
    id: null,
    title: "",
    artistName: "",
    coverPath: null,
    coverSourceUrl: null,
  };
}

function toDrafts(input: Array<Record<string, unknown>>): FavoriteDraft[] {
  const saved = input.map((favorite) => ({
    id: typeof favorite.id === "string" ? favorite.id : null,
    title: typeof favorite.title === "string" ? favorite.title : "",
    artistName:
      typeof favorite.artist_name === "string" ? favorite.artist_name : "",
    coverPath:
      typeof favorite.cover_path === "string" ? favorite.cover_path : null,
    coverSourceUrl:
      typeof favorite.cover_source_url === "string"
        ? favorite.cover_source_url
        : null,
  }));

  return [
    ...saved,
    ...Array.from({ length: Math.max(0, 3 - saved.length) }, emptyFavorite),
  ].slice(0, 3);
}

export function ProfilePersonalization() {
  const configured = isSupabaseConfigured();
  const [account, setAccount] = useState<{
    id: string;
    username: string;
    displayName: string;
    role: "admin" | "member";
  } | null>(null);
  const [savedTheme, setSavedTheme] = useState<ProfileThemeId>(
    defaultProfileTheme,
  );
  const [draftTheme, setDraftTheme] = useState<ProfileThemeId>(
    defaultProfileTheme,
  );
  const [favorites, setFavorites] = useState<FavoriteDraft[]>([
    emptyFavorite(),
    emptyFavorite(),
    emptyFavorite(),
  ]);
  const [searches, setSearches] = useState<Record<number, SearchCandidate[]>>(
    {},
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<ProfileThemeId | null>(null);

  useEffect(() => {
    if (!configured) return;

    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const [{ data: profile }, { data: savedFavorites }] = await Promise.all([
        supabase
          .from("member_public_profiles")
          .select("profile_theme,profile_theme_selected_at,username")
          .eq("id", auth.user.id)
          .maybeSingle(),
        supabase
          .from("profile_favorite_albums")
          .select(
            "id,title,artist_name,cover_path,cover_source_url,display_order",
          )
          .eq("participant_id", auth.user.id)
          .order("display_order"),
      ]);

      const theme = profile?.profile_theme as ProfileThemeId | undefined;
      const loadedTheme = profileThemes.some((item) => item.id === theme)
        ? theme!
        : defaultProfileTheme;
      setSavedTheme(loadedTheme);
      setDraftTheme(loadedTheme);
      setFavorites(toDrafts((savedFavorites ?? []) as Array<Record<string, unknown>>));
      const username =
        typeof profile?.username === "string" && profile.username.trim()
          ? profile.username
          : typeof auth.user.app_metadata.username === "string" &&
              auth.user.app_metadata.username.trim()
            ? auth.user.app_metadata.username
            : "membre";
      const displayName =
        typeof auth.user.app_metadata.display_name === "string" &&
        auth.user.app_metadata.display_name.trim()
          ? auth.user.app_metadata.display_name
          : username;
      const role = auth.user.app_metadata.role === "admin" ? "admin" : "member";
      setAccount({ id: auth.user.id, username, displayName, role });
    };

    void load();
  }, [configured]);

  useEffect(() => {
    if (draftTheme === defaultProfileTheme) {
      document.body.classList.remove("profile-theme-page");
      delete document.body.dataset.profileTheme;
      return;
    }
    document.body.classList.add("profile-theme-page");
    document.body.dataset.profileTheme = draftTheme;
    return () => {
      document.body.classList.remove("profile-theme-page");
      delete document.body.dataset.profileTheme;
    };
  }, [draftTheme]);

  const updateFavorite = (index: number, next: Partial<FavoriteDraft>) => {
    setFavorites((current) =>
      current.map((favorite, itemIndex) =>
        itemIndex === index ? { ...favorite, ...next } : favorite,
      ),
    );
  };

  const removeFavorite = (index: number) => updateFavorite(index, emptyFavorite());

  const moveFavorite = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= 3) return;
    setFavorites((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const selectSearchCover = (index: number, candidate: SearchCandidate) => {
    updateFavorite(index, {
      title: candidate.title || favorites[index].title,
      artistName: candidate.artist || favorites[index].artistName,
      coverPath: null,
      coverSourceUrl: candidate.thumbnailUrl,
    });
    setSearches((current) => ({ ...current, [index]: [] }));
  };

  const searchCover = async (index: number) => {
    const favorite = favorites[index];
    if (!favorite.title.trim()) {
      setMessage("Indique d’abord le titre de l’album.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      setMessage("Reconnecte-toi pour rechercher une pochette.");
      return;
    }

    const response = await fetch("/api/music/search-albums", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({
        title: favorite.title,
        artist: favorite.artistName,
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(
        typeof body?.error === "string"
          ? body.error
          : "La recherche de pochette est indisponible.",
      );
      return;
    }
    setSearches((current) => ({
      ...current,
      [index]: Array.isArray(body?.candidates)
        ? (body.candidates as SearchCandidate[])
        : [],
    }));
  };

  const uploadCover = async (index: number, file: File | null) => {
    if (!account || !file) return;
    if (!imageTypes.has(file.type) || file.size > 3 * 1024 * 1024) {
      setMessage("Choisis une image JPG, PNG ou WebP de 3 Mo maximum.");
      return;
    }

    const id = favorites[index].id ?? crypto.randomUUID();
    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const path = `${account.id}/${id}/cover.${extension}`;
    const { error } = await getSupabaseBrowserClient()
      .storage.from("profile-favorites")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "31536000",
      });
    if (error) {
      setMessage("La jaquette n’a pas pu être importée.");
      return;
    }

    updateFavorite(index, { id, coverPath: path, coverSourceUrl: null });
    setMessage("Jaquette importée : enregistre pour la publier.");
  };

  const applyThemeNow = async () => {
    if (!account || saving) return;
    setSaving(true);
    setMessage("");
    const { data: updatedProfile, error: profileError } = await getSupabaseBrowserClient()
      .from("member_public_profiles")
      .update({
        profile_theme: draftTheme,
        profile_theme_selected_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .select("id")
      .maybeSingle();
    if (profileError || !updatedProfile) {
      setSaving(false);
      setMessage("Le thème n’a pas pu être appliqué.");
      return;
    }
    setSavedTheme(draftTheme);
    window.location.reload();
  };

  const save = async () => {
    if (!account) return;

    const complete = favorites.filter(
      (favorite) => favorite.title.trim() || favorite.artistName.trim(),
    );
    if (
      complete.some(
        (favorite) => !favorite.title.trim() || !favorite.artistName.trim(),
      )
    ) {
      setMessage("Chaque album favori doit avoir un titre et un artiste.");
      return;
    }
    if (
      complete.some(
        (favorite) =>
          favorite.coverSourceUrl &&
          !/^(https:\/\/|\/)/.test(favorite.coverSourceUrl),
      )
    ) {
      setMessage("Une jaquette externe doit utiliser une adresse HTTPS.");
      return;
    }

    setSaving(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    const { data: updatedProfile, error: profileError } = await supabase
      .from("member_public_profiles")
      .update({
        profile_theme: draftTheme,
        profile_theme_selected_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .select("id")
      .maybeSingle();
    if (profileError || !updatedProfile) {
      setSaving(false);
      setMessage("Le thème n’a pas pu être enregistré.");
      return;
    }

    const normalized = complete.map((favorite, index) => ({
      ...favorite,
      id: favorite.id ?? crypto.randomUUID(),
      display_order: index + 1,
    }));
    const oldPaths = favorites
      .map((favorite) => favorite.coverPath)
      .filter((path): path is string => Boolean(path));
    const nextPaths = new Set(
      normalized
        .map((favorite) => favorite.coverPath)
        .filter((path): path is string => Boolean(path)),
    );
    const removablePaths = oldPaths.filter((path) => !nextPaths.has(path));
    if (removablePaths.length) {
      await supabase.storage.from("profile-favorites").remove(removablePaths);
    }

    const { error: deleteError } = await supabase
      .from("profile_favorite_albums")
      .delete()
      .eq("participant_id", account.id);
    if (deleteError) {
      setSaving(false);
      setMessage("Les favoris n’ont pas pu être mis à jour.");
      return;
    }

    if (normalized.length) {
      const { error: insertError } = await supabase
        .from("profile_favorite_albums")
        .insert(
          normalized.map((favorite) => ({
            id: favorite.id,
            participant_id: account.id,
            title: favorite.title.trim(),
            artist_name: favorite.artistName.trim(),
            cover_path: favorite.coverPath,
            cover_source_url: favorite.coverSourceUrl,
            source_catalog_key: null,
            display_order: favorite.display_order,
          })),
        );
      if (insertError) {
        setSaving(false);
        setMessage("Les favoris n’ont pas pu être enregistrés.");
        return;
      }
    }

    setSavedTheme(draftTheme);
    setFavorites(
      toDrafts(
        normalized.map((favorite) => ({
          id: favorite.id,
          title: favorite.title,
          artist_name: favorite.artistName,
          cover_path: favorite.coverPath,
          cover_source_url: favorite.coverSourceUrl,
        })),
      ),
    );
    setSaving(false);
    setMessage("Thème et albums favoris enregistrés.");
  };

  if (!configured || !account) return null;

  return (
    <section
      className="profile-personalization profile-theme"
      data-profile-theme={
        draftTheme === defaultProfileTheme ? undefined : draftTheme
      }
    >
      <header>
        <p className="eyebrow">PERSONNALISATION</p>
        <h2>Ma fiche, à mon image.</h2>
        <p>Choisis un thème, puis enregistre : il devient public immédiatement.</p>
      </header>
      <div className="profile-personalization__layout">
        <div>
          <fieldset className="theme-picker">
            <legend>Thème de profil</legend>
            <div className="theme-picker__grid">
              {profileThemes.map((theme) => (
                <article
                  key={theme.id}
                  className={
                    draftTheme === theme.id
                      ? "theme-card profile-theme is-selected"
                      : "theme-card profile-theme"
                  }
                  data-profile-theme={theme.id}
                >
                  <button
                    type="button"
                    className="theme-card__choice"
                    onClick={() => setDraftTheme(theme.id)}
                    aria-pressed={draftTheme === theme.id}
                  >
                    <span className="theme-card__mini" aria-hidden="true">
                      <i>{account.displayName.slice(0, 1).toUpperCase()}</i>
                      <span>
                        <b>{account.displayName}</b>
                        <small>@{account.username}</small>
                      </span>
                      <em />
                      <strong>12</strong>
                      <u />
                    </span>
                    <span className="theme-card__colors">
                      {theme.previewColors.map((color) => (
                        <i key={color} style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <b>{theme.name}</b>
                    <small>{theme.description}</small>
                  </button>
                  <button
                    type="button"
                    className="theme-card__preview"
                    onClick={() => setPreviewTheme(theme.id)}
                  >
                    Voir en grand
                  </button>
                </article>
              ))}
            </div>
            <div className="theme-picker__actions">
              <button
                type="button"
                className="button"
                onClick={() => void applyThemeNow()}
                disabled={saving || draftTheme === savedTheme}
              >
                {saving ? "Application…" : "Appliquer ce thème et actualiser la page"}
              </button>
              <button
                type="button"
                className="text-link"
                onClick={() => setDraftTheme(savedTheme)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="text-link"
                onClick={() => setDraftTheme(defaultProfileTheme)}
              >
                Revenir au thème par défaut
              </button>
            </div>
          </fieldset>

          <section className="favorite-editor" aria-labelledby="favorite-editor-heading">
            <p className="eyebrow">COLLECTION PERSONNELLE</p>
            <h3 id="favorite-editor-heading">Mes 3 albums préférés</h3>
            <p>
              Ajoute tes propres albums : renseigne le titre et l’artiste, puis
              importe ta jaquette. Ils ne doivent pas appartenir au catalogue
              DOL ZIKLUB.
            </p>
            <div className="favorite-editor__slots">
              {favorites.map((favorite, index) => (
                <article
                  className="favorite-editor__slot"
                  key={favorite.id ?? `empty-${index}`}
                >
                  <div className="favorite-editor__slot-head">
                    <span>Album favori {index + 1}</span>
                    <div>
                      <button
                        type="button"
                        onClick={() => moveFavorite(index, -1)}
                        disabled={index === 0}
                        aria-label="Déplacer vers la gauche"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFavorite(index, 1)}
                        disabled={index === 2}
                        aria-label="Déplacer vers la droite"
                      >
                        →
                      </button>
                      <button type="button" onClick={() => removeFavorite(index)}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                  <label>
                    Titre
                    <input
                      value={favorite.title}
                      maxLength={180}
                      onChange={(event) =>
                        updateFavorite(index, { title: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Artiste
                    <input
                      value={favorite.artistName}
                      maxLength={180}
                      onChange={(event) =>
                        updateFavorite(index, { artistName: event.target.value })
                      }
                    />
                  </label>
                  <div className="favorite-editor__cover-actions">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => void searchCover(index)}
                    >
                      Rechercher une pochette (facultatif)
                    </button>
                    <label className="text-link">
                      Importer ma jaquette
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          void uploadCover(index, event.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  </div>
                  {favorite.coverPath || favorite.coverSourceUrl ? (
                    <p className="favorite-editor__cover-status">
                      Jaquette sélectionnée.
                    </p>
                  ) : null}
                  {searches[index]?.length ? (
                    <div className="favorite-editor__results">
                      {searches[index].map((candidate) => (
                        <button
                          type="button"
                          key={candidate.id}
                          onClick={() => selectSearchCover(index, candidate)}
                        >
                          {candidate.thumbnailUrl ? (
                            <img src={candidate.thumbnailUrl} alt="" />
                          ) : null}
                          <span>
                            <b>{candidate.title}</b>
                            <small>{candidate.artist}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <button
            type="button"
            className="button"
            onClick={() => void applyThemeNow()}
            disabled={saving}
          >
            {saving ? "Application…" : "Enregistrer mon thème"}
          </button>
          {message ? (
            <p className="account-message" role="status">
              {message}
            </p>
          ) : null}
        </div>
      </div>
      {previewTheme ? (
        <div
          className="theme-preview-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={`Aperçu du thème ${profileThemes.find((theme) => theme.id === previewTheme)?.name ?? ""}`}
        >
          <div className="theme-preview-dialog__panel">
            <button
              type="button"
              className="theme-preview-dialog__close"
              onClick={() => setPreviewTheme(null)}
            >
              Fermer
            </button>
            <p className="eyebrow">APERÇU DU THÈME</p>
            <ProfileThemePreview
              theme={previewTheme}
              displayName={account.displayName}
              username={account.username}
              role={account.role}
            />
            <button
              type="button"
              className="button"
              onClick={() => {
                setDraftTheme(previewTheme);
                setPreviewTheme(null);
              }}
            >
              Choisir ce thème
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
