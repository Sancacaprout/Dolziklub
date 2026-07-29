"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cloneProfileCustomTheme,
  type ProfileCustomThemeConfigV1,
} from "@/lib/profile-custom-theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ThemeSnapshot = {
  status: "never" | "draft" | "published" | "changes";
  draft: {
    config: ProfileCustomThemeConfigV1;
    revision: number;
    updatedAt?: string;
    tutorialCompleted: boolean;
  } | null;
  publication: {
    config: ProfileCustomThemeConfigV1;
    revision: number;
    publishedAt?: string;
  } | null;
};

type RemoteState = {
  ready: boolean;
  draftRevision: number;
  publishedRevision: number | null;
  savedConfig: ProfileCustomThemeConfigV1 | null;
  status: ThemeSnapshot["status"];
};

const initialRemote: RemoteState = {
  ready: false,
  draftRevision: 0,
  publishedRevision: null,
  savedConfig: null,
  status: "never",
};

async function themeRequest(path: string, init?: RequestInit) {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Reconnecte-toi pour enregistrer ton thème.");
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "L’opération a échoué.");
  return payload;
}

function tutorialCompletedLocally() {
  return window.localStorage.getItem("dolziklub:custom-theme-tutorial:v1") === "done";
}

export function CustomThemePersistence({
  config,
  onReplace,
}: {
  config: ProfileCustomThemeConfigV1;
  onReplace: (config: ProfileCustomThemeConfigV1) => void;
}) {
  const router = useRouter();
  const [remote, setRemote] = useState<RemoteState>(initialRemote);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = useMemo(
    () => remote.savedConfig !== null && JSON.stringify(remote.savedConfig) !== JSON.stringify(config),
    [config, remote.savedConfig],
  );
  const canPublish = dirty || remote.status !== "published";
  const canDiscard = remote.draftRevision > 0 && (
    dirty || remote.status === "draft" || remote.status === "changes"
  );

  useEffect(() => {
    let active = true;
    void themeRequest("/api/profile-theme/draft")
      .then((payload) => {
        if (!active) return;
        const snapshot = payload as unknown as ThemeSnapshot;
        const loadedConfig = snapshot.draft?.config ?? snapshot.publication?.config ?? cloneProfileCustomTheme();
        onReplace(loadedConfig);
        setRemote({
          ready: true,
          draftRevision: snapshot.draft?.revision ?? 0,
          publishedRevision: snapshot.publication?.revision ?? null,
          savedConfig: cloneProfileCustomTheme(loadedConfig),
          status: snapshot.status,
        });
      })
      .catch((cause) => {
        if (!active) return;
        setMessage(cause instanceof Error ? cause.message : "Le brouillon est indisponible.");
        setRemote((current) => ({ ...current, ready: true }));
      });
    return () => { active = false; };
  }, [onReplace]);

  const saveCurrentDraft = async () => {
    const payload = await themeRequest("/api/profile-theme/draft", {
      method: "POST",
      body: JSON.stringify({
        config,
        expectedRevision: remote.draftRevision,
        tutorialCompleted: tutorialCompletedLocally(),
      }),
    });
    const revision = Number(payload?.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("La révision enregistrée est invalide.");
    setRemote((current) => ({
      ...current,
      draftRevision: revision,
      savedConfig: cloneProfileCustomTheme(config),
      status: current.publishedRevision === revision ? "published" : current.publishedRevision ? "changes" : "draft",
    }));
    return revision;
  };

  const save = async () => {
    if (!remote.ready || busy || !dirty && remote.draftRevision > 0) return;
    setBusy(true);
    setMessage("");
    try {
      await saveCurrentDraft();
      setMessage("Brouillon enregistré en privé.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Le brouillon n’a pas pu être enregistré.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!remote.ready || busy || !canPublish) return;
    setBusy(true);
    setMessage("");
    try {
      const revision = dirty || remote.draftRevision === 0
        ? await saveCurrentDraft()
        : remote.draftRevision;
      const payload = await themeRequest("/api/profile-theme/publish", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: revision }),
      });
      const publishedRevision = Number(payload?.revision);
      if (!Number.isSafeInteger(publishedRevision) || publishedRevision < 1) throw new Error("La révision publiée est invalide.");
      setRemote((current) => ({
        ...current,
        draftRevision: publishedRevision,
        publishedRevision,
        savedConfig: cloneProfileCustomTheme(config),
        status: "published",
      }));
      setMessage("Thème publié et activé sur ton profil.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Le thème n’a pas pu être publié.");
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!remote.ready || busy || !canDiscard) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = await themeRequest(`/api/profile-theme/draft?expectedRevision=${remote.draftRevision}`, { method: "DELETE" });
      const restored = payload?.config as ProfileCustomThemeConfigV1;
      const revision = Number(payload?.revision ?? 0);
      const publishedRevision = payload?.publishedRevision == null ? null : Number(payload.publishedRevision);
      onReplace(restored);
      setRemote({
        ready: true,
        draftRevision: revision,
        publishedRevision,
        savedConfig: cloneProfileCustomTheme(restored),
        status: publishedRevision ? "published" : "never",
      });
      setMessage(publishedRevision ? "Modifications annulées : retour à la version publiée." : "Brouillon supprimé : retour à la base neutre.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Les modifications ne peuvent pas être annulées.");
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = !remote.ready
    ? "CHARGEMENT DU BROUILLON"
    : dirty
      ? "MODIFICATIONS LOCALES"
      : remote.status === "published"
        ? "VERSION PUBLIÉE"
        : remote.status === "changes"
          ? "BROUILLON À PUBLIER"
          : remote.status === "draft"
            ? "BROUILLON PRIVÉ"
            : "JAMAIS CONFIGURÉ";

  return (
    <section className="custom-theme-persistence" aria-busy={busy}>
      <p><span>ÉTAT</span><b>{statusLabel}</b></p>
      <div>
        <button type="button" disabled={!remote.ready || busy || !dirty && remote.draftRevision > 0} onClick={() => void save()}>Enregistrer le brouillon</button>
        <button type="button" disabled={!remote.ready || busy || !canPublish} onClick={() => void publish()}>Publier et activer</button>
        <button type="button" disabled={!remote.ready || busy || !canDiscard} onClick={() => void discard()}>Annuler les modifications</button>
      </div>
      {message ? <small role="status">{message}</small> : null}
    </section>
  );
}
