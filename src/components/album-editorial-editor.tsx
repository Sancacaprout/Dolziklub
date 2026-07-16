"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createDeferredAuthSync } from "@/lib/supabase/deferred-auth-sync";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Album } from "@/types/album";

type AlbumEditorialEditorProps = {
  album: Album;
  drawEntryId: string;
};

type EditorialForm = {
  releaseYear: string;
  origin: string;
  language: string;
  genres: string;
  projectType: string;
  artistDescription: string;
  albumDescription: string;
};

function formFromAlbum(album: Album): EditorialForm {
  return {
    releaseYear: album.releaseYear?.toString() ?? "",
    origin: album.origin ?? "",
    language: album.language ?? "",
    genres: album.genres.join(", "),
    projectType: album.projectType ?? "",
    artistDescription: album.artistDescription ?? "",
    albumDescription: album.albumDescription ?? "",
  };
}

const cleanNullable = (value: string) => value.trim() || null;

export function AlbumEditorialEditor({ album, drawEntryId }: AlbumEditorialEditorProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(() => formFromAlbum(album));

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();
    let active = true;
    const syncAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setIsAdmin(false);
        setUserId(null);
        return;
      }

      const { data } = await supabase
        .from("member_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      setUserId(user.id);
      setIsAdmin(data?.role === "admin");
    };

    const deferred = createDeferredAuthSync(syncAccess);
    void syncAccess();
    const { data: listener } = supabase.auth.onAuthStateChange(() => deferred.schedule());

    return () => {
      active = false;
      deferred.cancel();
      listener.subscription.unsubscribe();
    };
  }, []);

  const update = (field: keyof EditorialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;

    const year = form.releaseYear.trim() ? Number(form.releaseYear) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
      setMessage("L’année doit être comprise entre 1900 et 2100.");
      return;
    }

    const genres = [...new Set(
      form.genres.split(",").map((genre) => genre.trim()).filter(Boolean),
    )].slice(0, 12);

    setSaving(true);
    setMessage(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("album_editorial_metadata")
      .upsert({
        draw_entry_id: drawEntryId,
        release_year: year,
        origin: cleanNullable(form.origin),
        language: cleanNullable(form.language),
        genres,
        project_type: cleanNullable(form.projectType),
        artist_description: cleanNullable(form.artistDescription),
        album_description: cleanNullable(form.albumDescription),
        updated_by: userId,
      }, { onConflict: "draw_entry_id" })
      .select("draw_entry_id")
      .single();
    setSaving(false);

    if (error) {
      setMessage(`Impossible d’enregistrer : ${error.message}`);
      return;
    }

    setEditing(false);
    setMessage("La fiche de l’album a bien été mise à jour.");
    router.refresh();
  };

  const reset = async () => {
    if (!window.confirm("Réinitialiser les informations éditoriales de cet album ?")) return;

    setSaving(true);
    setMessage(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("album_editorial_metadata")
      .delete()
      .eq("draw_entry_id", drawEntryId)
      .select("draw_entry_id")
      .maybeSingle();
    setSaving(false);

    if (error) {
      setMessage(`Impossible de réinitialiser : ${error.message}`);
      return;
    }

    setForm(formFromAlbum({
      ...album,
      releaseYear: null,
      origin: null,
      language: null,
      genres: [],
      projectType: null,
      artistDescription: null,
      albumDescription: null,
    }));
    setEditing(false);
    setMessage("Les informations éditoriales ont été réinitialisées.");
    router.refresh();
  };

  if (!isAdmin) return null;

  return (
    <section className="album-editorial-admin" aria-labelledby="album-editorial-title">
      <div className="album-editorial-admin__header">
        <div>
          <p className="eyebrow">ESPACE ADMIN</p>
          <h2 id="album-editorial-title">Compléter la fiche de l’album</h2>
          <p>Ces informations deviennent visibles sur la fiche dès leur validation.</p>
        </div>
        <button
          className="button button--dark"
          type="button"
          onClick={() => {
            setEditing((value) => !value);
            setMessage(null);
          }}
          aria-expanded={editing}
        >
          {editing ? "Fermer l’édition" : "Activer le mode édition"}
        </button>
      </div>

      {editing && (
        <form className="album-editorial-admin__form" onSubmit={save}>
          <div className="album-editorial-admin__grid">
            <label>
              Année de sortie
              <input type="number" min="1900" max="2100" value={form.releaseYear} onChange={(event) => update("releaseYear", event.target.value)} />
            </label>
            <label>
              Format / projet
              <input maxLength={120} value={form.projectType} onChange={(event) => update("projectType", event.target.value)} placeholder="Album, EP, mixtape…" />
            </label>
            <label>
              Origine
              <input maxLength={120} value={form.origin} onChange={(event) => update("origin", event.target.value)} />
            </label>
            <label>
              Langue
              <input maxLength={120} value={form.language} onChange={(event) => update("language", event.target.value)} />
            </label>
          </div>

          <label>
            Genres — séparés par des virgules
            <input maxLength={600} value={form.genres} onChange={(event) => update("genres", event.target.value)} placeholder="Hip-hop, électronique, soul" />
          </label>
          <label>
            Présentation de l’artiste
            <textarea maxLength={5000} value={form.artistDescription} onChange={(event) => update("artistDescription", event.target.value)} />
          </label>
          <label>
            À propos de l’album
            <textarea maxLength={5000} value={form.albumDescription} onChange={(event) => update("albumDescription", event.target.value)} />
          </label>

          <div className="album-editorial-admin__actions">
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer la fiche"}
            </button>
            <button className="album-editorial-admin__reset" type="button" disabled={saving} onClick={reset}>
              Réinitialiser ces informations
            </button>
          </div>
        </form>
      )}

      {message && <p className="album-editorial-admin__message" role="status">{message}</p>}
    </section>
  );
}