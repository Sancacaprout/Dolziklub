"use client";

import { useEffect, useId, useState } from "react";
import { YouTubeClipEmbed } from "@/components/youtube-clip-embed";
import type { ProfileThemeId } from "@/lib/profile-themes";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  isYouTubeVideoId,
  parseYouTubeVideoId,
  youtubeWatchUrl,
} from "@/lib/youtube-video";

export function FavoriteClipPanel({ theme }: { theme: ProfileThemeId }) {
  const inputId = useId();
  const messageId = useId();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [savedVideoId, setSavedVideoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setMemberId(auth.user.id);
      const { data } = await supabase
        .from("member_public_profiles")
        .select("favorite_clip_youtube_id")
        .eq("id", auth.user.id)
        .maybeSingle();
      const videoId = isYouTubeVideoId(data?.favorite_clip_youtube_id)
        ? data.favorite_clip_youtube_id
        : null;
      setSavedVideoId(videoId);
      setValue(videoId ? youtubeWatchUrl(videoId) : "");
    };
    void load();
  }, []);

  const parsedVideoId = parseYouTubeVideoId(value);
  const invalid = Boolean(value.trim()) && !parsedVideoId;

  const persist = async (videoId: string | null) => {
    if (!memberId || saving) return;
    setSaving(true);
    setMessage("");
    const { data, error } = await getSupabaseBrowserClient()
      .from("member_public_profiles")
      .update({ favorite_clip_youtube_id: videoId })
      .eq("id", memberId)
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      setMessage("Le clip n’a pas pu être enregistré.");
      return;
    }
    setSavedVideoId(videoId);
    setValue(videoId ? youtubeWatchUrl(videoId) : "");
    setMessage(videoId ? "Clip préféré enregistré." : "Clip préféré supprimé.");
  };

  return (
    <section
      className="favorite-albums-panel favorite-clip-panel profile-theme"
      data-profile-theme={theme}
      aria-labelledby="favorite-clip-panel-heading"
    >
      <header className="favorite-albums-panel__header">
        <p className="eyebrow">VIDÉO FÉTICHE</p>
        <h3 id="favorite-clip-panel-heading">Mon clip préféré</h3>
        <p>Colle un lien YouTube : seule son identité vidéo sécurisée sera enregistrée.</p>
      </header>
      <div className="favorite-clip-panel__layout">
        <div className="favorite-clip-panel__field">
          <label htmlFor={inputId}>Lien YouTube du clip</label>
          <input
            id={inputId}
            value={value}
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://www.youtube.com/watch?v=…"
            aria-invalid={invalid}
            aria-describedby={messageId}
            disabled={saving}
            onChange={(event) => {
              setValue(event.target.value);
              setMessage("");
            }}
          />
          <small id={messageId}>
            {invalid
              ? "Lien invalide. Utilise YouTube, YouTube Music, Shorts ou youtu.be."
              : "Le lecteur ne démarre jamais automatiquement."}
          </small>
          <div className="favorite-clip-panel__actions">
            <button
              className="button"
              type="button"
              disabled={saving || !parsedVideoId}
              onClick={() => void persist(parsedVideoId)}
            >
              {saving ? "Enregistrement…" : "Enregistrer mon clip"}
            </button>
            {savedVideoId ? (
              <button className="text-link" type="button" disabled={saving} onClick={() => void persist(null)}>
                Supprimer mon clip
              </button>
            ) : null}
          </div>
        </div>
        {parsedVideoId ? (
          <YouTubeClipEmbed videoId={parsedVideoId} title="Aperçu de mon clip préféré" />
        ) : (
          <div className="favorite-clip-panel__placeholder">
            <span aria-hidden="true">▶</span>
            <b>L’aperçu apparaîtra ici.</b>
          </div>
        )}
      </div>
      {message ? <p className="account-message" role="status">{message}</p> : null}
    </section>
  );
}
