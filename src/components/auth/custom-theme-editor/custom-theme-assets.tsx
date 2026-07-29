"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CUSTOM_THEME_MAX_DECORATIONS,
  cloneProfileCustomTheme,
  customThemeDecorationSlots,
  referencedProfileThemeAssetIds,
  type CustomThemeDecorationSlot,
  type ProfileCustomThemeAsset,
  type ProfileCustomThemeAssetMap,
  type ProfileCustomThemeConfigV1,
} from "@/lib/profile-custom-theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const slotLabels: Record<CustomThemeDecorationSlot, string> = {
  "page-top-left": "Page · haut gauche",
  "page-top-right": "Page · haut droite",
  "header-background": "En-tête · arrière-plan",
  "quiz-background": "Kouize · arrière-plan",
  "podium-side": "Podium · côté",
  "stats-background": "Statistiques · arrière-plan",
  "between-sections": "Entre les sections",
  "page-bottom": "Page · bas",
};

async function assetRequest(path: string, init?: RequestInit) {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Reconnecte-toi pour gérer tes images.");
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  const payload = await response.json().catch(() => null) as {
    error?: string;
    asset?: ProfileCustomThemeAsset;
    assets?: ProfileCustomThemeAsset[];
  } | null;
  if (!response.ok) throw new Error(payload?.error ?? "L’opération a échoué.");
  return payload;
}

export function CustomThemeAssets({
  config,
  onCommit,
  onAssetMapChange,
}: {
  config: ProfileCustomThemeConfigV1;
  onCommit: (config: ProfileCustomThemeConfigV1) => void;
  onAssetMapChange: (assets: ProfileCustomThemeAssetMap) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<ProfileCustomThemeAsset[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void assetRequest("/api/profile-theme/assets")
      .then((payload) => {
        if (active) setAssets(payload?.assets ?? []);
      })
      .catch((cause) => {
        if (active) setMessage(cause instanceof Error ? cause.message : "Images indisponibles.");
      });
    return () => { active = false; };
  }, []);

  const syncAssetMap = useCallback((
    nextConfig: ProfileCustomThemeConfigV1,
    availableAssets: ProfileCustomThemeAsset[] = assets,
  ) => {
    const referenced = new Set(referencedProfileThemeAssetIds(nextConfig));
    const map = Object.fromEntries(
      availableAssets.filter((asset) => referenced.has(asset.id)).map((asset) => [asset.id, asset.signedUrl]),
    );
    onAssetMapChange(map);
  }, [assets, onAssetMapChange]);

  useEffect(() => {
    syncAssetMap(config);
  }, [config, syncAssetMap]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      const payload = await assetRequest("/api/profile-theme/assets", { method: "POST", body });
      if (!payload?.asset) throw new Error("La réponse de l’upload est incomplète.");
      const uploadedAsset = payload.asset as ProfileCustomThemeAsset;
      setAssets((current) => [uploadedAsset, ...current]);
      setSelectedAssetId(uploadedAsset.id);
      setMessage("Image privée convertie en WebP et enregistrée.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "L’image n’a pas pu être envoyée.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const applyAsBackground = (assetId: string) => {
    const next = cloneProfileCustomTheme(config);
    next.backgrounds.mode = "image";
    next.backgrounds.image.assetId = assetId;
    syncAssetMap(next);
    onCommit(next);
    setSelectedAssetId(assetId);
    setMessage("Image appliqu\u00e9e au fond. Ajuste son cadrage juste en dessous.");
  };

  const addDecoration = (assetId: string) => {
    if (config.decorations.length >= CUSTOM_THEME_MAX_DECORATIONS) return;
    const next = cloneProfileCustomTheme(config);
    next.decorations.push({
      id: crypto.randomUUID(),
      assetId,
      slot: customThemeDecorationSlots[next.decorations.length % customThemeDecorationSlots.length],
      size: 120,
      opacity: 1,
      rotation: 0,
      mirror: false,
      visibility: "all",
      alt: "",
    });
    syncAssetMap(next);
    onCommit(next);
    setSelectedAssetId(assetId);
    setMessage("D\u00e9coration ajout\u00e9e dans un emplacement s\u00fbr. Ses r\u00e9glages sont affich\u00e9s plus bas.");
  };

  const removeAsset = async (asset: ProfileCustomThemeAsset) => {
    if (referencedProfileThemeAssetIds(config).includes(asset.id)) {
      setMessage("Retire d’abord cette image du fond et des décorations.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await assetRequest(`/api/profile-theme/assets?id=${encodeURIComponent(asset.id)}`, { method: "DELETE" });
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setMessage("Image supprimée.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "L’image n’a pas pu être supprimée.");
    } finally {
      setBusy(false);
    }
  };

  const updateDecoration = (
    id: string,
    patch: Partial<ProfileCustomThemeConfigV1["decorations"][number]>,
  ) => {
    const next = cloneProfileCustomTheme(config);
    next.decorations = next.decorations.map((decoration) =>
      decoration.id === id ? { ...decoration, ...patch } : decoration,
    );
    onCommit(next);
  };

  return (
    <>
      <div className="custom-theme-asset-examples">
        <p><b>Image de fond</b><span>Exemple : une texture papier, une photo floue ou une pochette qui couvre toute la page derrière le profil.</span></p>
        <p><b>Décoration</b><span>Exemple : un sticker, une étoile ou un petit dessin placé dans l’un des huit emplacements autorisés.</span></p>
      </div>
      <label className="custom-theme-asset-upload">
        <span>Ajouter une image privée</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <small>JPG, PNG ou WebP · 5 Mo max · réécrit en WebP · 2048 px max</small>
      </label>
      {message ? <p className="custom-theme-asset-message" role="status">{message}</p> : null}
      {assets.length ? (
        <div className="custom-theme-asset-grid">
          {assets.map((asset) => (
            <article key={asset.id} data-selected={selectedAssetId === asset.id}>
              {/* URL privée signée, produite uniquement par notre API. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.signedUrl} alt="Aperçu de l’image importée" />
              <small>{asset.width}×{asset.height} · {Math.ceil(asset.byteSize / 1024)} Ko</small>
              <div>
                <button type="button" disabled={busy} onClick={() => applyAsBackground(asset.id)}>Utiliser en fond</button>
                <button type="button" disabled={busy || config.decorations.length >= CUSTOM_THEME_MAX_DECORATIONS} onClick={() => addDecoration(asset.id)}>Ajouter une déco</button>
                <button type="button" disabled={busy} onClick={() => void removeAsset(asset)}>Supprimer</button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="custom-theme-editor__hint">Aucune image privée enregistrée.</p>}

      {config.backgrounds.mode === "image" ? (
        <fieldset className="custom-theme-asset-options">
          <legend>Image de fond</legend>
          <label className="custom-theme-field"><span>Opacité · {Math.round(config.backgrounds.image.opacity * 100)}%</span><input type="range" min="0.1" max="1" step="0.05" value={config.backgrounds.image.opacity} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.image.opacity = Number(event.target.value); onCommit(next); }} /></label>
          <label className="custom-theme-field"><span>Cadrage</span><select value={config.backgrounds.image.size} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.image.size = event.target.value as "cover" | "contain"; onCommit(next); }}><option value="cover">Couvrir</option><option value="contain">Contenir</option></select></label>
          <label className="custom-theme-field"><span>Position</span><select value={config.backgrounds.image.position} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.image.position = event.target.value as ProfileCustomThemeConfigV1["backgrounds"]["image"]["position"]; onCommit(next); }}>{["center", "top", "bottom", "left", "right"].map((position) => <option key={position} value={position}>{position}</option>)}</select></label>
          <button type="button" className="custom-theme-editor__reset-property" onClick={() => { const next = cloneProfileCustomTheme(config); next.backgrounds.mode = "solid"; next.backgrounds.image.assetId = null; onCommit(next); }}>Retirer l’image de fond</button>
        </fieldset>
      ) : null}

      <div className="custom-theme-decoration-heading">
        <b>Décorations</b>
        <span>{config.decorations.length}/{CUSTOM_THEME_MAX_DECORATIONS}</span>
      </div>
      {config.decorations.map((decoration, index) => (
        <fieldset className="custom-theme-decoration-card" key={decoration.id}>
          <legend>Décoration {index + 1}</legend>
          <label className="custom-theme-field"><span>Emplacement fixe</span><select value={decoration.slot} onChange={(event) => updateDecoration(decoration.id, { slot: event.target.value as CustomThemeDecorationSlot })}>{customThemeDecorationSlots.map((slot) => <option key={slot} value={slot}>{slotLabels[slot]}</option>)}</select></label>
          <label className="custom-theme-field"><span>Taille · {decoration.size}px</span><input type="range" min="24" max="320" value={decoration.size} onChange={(event) => updateDecoration(decoration.id, { size: Number(event.target.value) })} /></label>
          <label className="custom-theme-field"><span>Opacité · {Math.round(decoration.opacity * 100)}%</span><input type="range" min="0.1" max="1" step="0.05" value={decoration.opacity} onChange={(event) => updateDecoration(decoration.id, { opacity: Number(event.target.value) })} /></label>
          <label className="custom-theme-field"><span>Rotation · {decoration.rotation}°</span><input type="range" min="-15" max="15" value={decoration.rotation} onChange={(event) => updateDecoration(decoration.id, { rotation: Number(event.target.value) })} /></label>
          <label className="custom-theme-field"><span>Visibilité</span><select value={decoration.visibility} onChange={(event) => updateDecoration(decoration.id, { visibility: event.target.value as "all" | "desktop" | "mobile" })}><option value="all">Toutes les tailles</option><option value="desktop">Ordinateur seulement</option><option value="mobile">Mobile seulement</option></select></label>
          <label className="custom-theme-check"><input type="checkbox" checked={decoration.mirror} onChange={(event) => updateDecoration(decoration.id, { mirror: event.target.checked })} /><span>Miroir horizontal</span></label>
          <button type="button" className="custom-theme-editor__reset-property" onClick={() => { const next = cloneProfileCustomTheme(config); next.decorations = next.decorations.filter((item) => item.id !== decoration.id); onCommit(next); }}>Retirer cette décoration</button>
        </fieldset>
      ))}
    </>
  );
}

export function CustomThemeMotion({
  config,
  onCommit,
}: {
  config: ProfileCustomThemeConfigV1;
  onCommit: (config: ProfileCustomThemeConfigV1) => void;
}) {
  const update = (patch: Partial<ProfileCustomThemeConfigV1["motion"]>) => {
    const next = cloneProfileCustomTheme(config);
    next.motion = { ...next.motion, ...patch };
    onCommit(next);
  };
  const applyPreset = (preset: "subtle" | "dynamic" | "glow") => {
    if (preset === "subtle") update({ entrance: "fade", hover: "lift", link: "underline", duration: 200 });
    if (preset === "dynamic") update({ entrance: "slide", hover: "zoom", link: "underline", duration: 300 });
    if (preset === "glow") update({ entrance: "fade", hover: "glow", link: "underline", duration: 350 });
  };
  return (
    <>
      <label className="custom-theme-field"><span>Entrée des sections</span><select value={config.motion.entrance} onChange={(event) => update({ entrance: event.target.value as "none" | "fade" | "slide" })}><option value="none">Aucune</option><option value="fade">Fondu</option><option value="slide">Glissement court</option></select></label>
      <div className="custom-theme-motion-presets" role="group" aria-label="Ambiances de mouvement"><button type="button" onClick={() => applyPreset("subtle")}>Subtil</button><button type="button" onClick={() => applyPreset("dynamic")}>Dynamique</button><button type="button" onClick={() => applyPreset("glow")}>Halo</button></div>
      <label className="custom-theme-field"><span>Survol général</span><select value={config.motion.hover} onChange={(event) => update({ hover: event.target.value as "none" | "lift" | "zoom" | "glow" })}><option value="none">Aucun</option><option value="lift">Soulèvement</option><option value="zoom">Zoom léger</option><option value="glow">Halo</option></select></label>
      <label className="custom-theme-field"><span>Liens</span><select value={config.motion.link} onChange={(event) => update({ link: event.target.value as "none" | "underline" })}><option value="none">Standard</option><option value="underline">Soulignement animé</option></select></label>
      <label className="custom-theme-field"><span>Durée · {config.motion.duration} ms</span><input type="range" min="100" max="400" step="25" value={config.motion.duration} onChange={(event) => update({ duration: Number(event.target.value) })} /></label>
      <p className="custom-theme-editor__hint">Les mouvements sont automatiquement neutralisés si le visiteur préfère réduire les animations.</p>
    </>
  );
}
