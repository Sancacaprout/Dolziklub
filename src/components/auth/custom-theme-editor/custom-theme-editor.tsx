"use client";

import Link from "next/link";
import { CustomThemeAssets, CustomThemeMotion } from "@/components/auth/custom-theme-editor/custom-theme-assets";
import { CustomThemeTutorial } from "@/components/auth/custom-theme-editor/custom-theme-tutorial";
import { CustomThemePersistence } from "@/components/auth/custom-theme-editor/custom-theme-persistence";
import {
  CustomThemeSectionControls,
  CustomThemeSectionNavigation,
} from "@/components/auth/custom-theme-editor/custom-theme-section-controls";
import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyCustomThemeInspiration,
  cloneProfileCustomTheme,
  createCustomThemePreviewUpdateMessage,
  createCustomThemePreviewFocusMessage,
  customThemeFontFamilies,
  customThemeInspirations,
  customThemePatternKinds,
  customThemeTypographyRoles,
  defaultProfileCustomTheme,
  readTrustedCustomThemePreviewReady,
  normalizeProfileCustomThemeV2,
  readTrustedCustomThemePreviewSection,
  upgradeProfileCustomThemeV1ToV2,
  type CustomThemeFontFamily,
  type CustomThemePatternKind,
  type CustomThemeTypographyRole,
  type CustomThemeTypographyToken,
  type ProfileCustomThemeAssetMap,
  type ProfileCustomThemeConfigV2,
  type ProfileCustomThemeSectionId,
} from "@/lib/profile-custom-theme";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const MAX_HISTORY = 50;
const HEX_COLOR = /^#[0-9A-F]{6}$/i;

type Account = { username: string; displayName: string };
type HistoryState = {
  past: ProfileCustomThemeConfigV2[];
  present: ProfileCustomThemeConfigV2;
  future: ProfileCustomThemeConfigV2[];
};
type HistoryAction =
  | { type: "commit"; value: ProfileCustomThemeConfigV2 }
  | { type: "load"; value: ProfileCustomThemeConfigV2 }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" };

const colorFields = [
  ["page", "Page"],
  ["surface", "Surface principale"],
  ["surfaceAlt", "Surface secondaire"],
  ["text", "Texte"],
  ["mutedText", "Texte discret"],
  ["accent", "Accent principal"],
  ["accentAlt", "Accent secondaire"],
  ["title", "Titres"],
  ["border", "Bordures"],
  ["link", "Liens"],
  ["buttonBackground", "Fond des boutons"],
  ["buttonText", "Texte des boutons"],
  ["badgeBackground", "Fond des badges"],
  ["badgeText", "Texte des badges"],
  ["statBackground", "Fond des statistiques"],
  ["statText", "Texte des statistiques"],
  ["separator", "Séparateurs"],
] as const;

const typographyLabels: Record<CustomThemeTypographyRole, string> = {
  display: "Grands titres",
  body: "Texte courant",
  label: "Labels",
  button: "Boutons",
  stat: "Statistiques",
};

const fontLabels: Record<CustomThemeFontFamily, string> = {
  "space-grotesk": "Space Grotesk",
  "dm-mono": "DM Mono",
  "system-sans": "Sans-serif système",
  "system-serif": "Serif système",
  "editorial-serif": "Serif éditoriale (Didot / Bodoni)",
  "humanist-sans": "Sans humaniste (Trebuchet)",
  "condensed-sans": "Sans condensée (Arial Narrow)",
  "rounded-sans": "Sans arrondie",
  typewriter: "Machine à écrire",
  poster: "Affiche épaisse (Impact)",
};

const patternLabels: Record<CustomThemePatternKind, string> = {
  none: "Aucun",
  dots: "Points",
  grid: "Grille",
  paper: "Papier",
  grain: "Grain",
  vinyl: "Vinyle",
  lines: "Lignes",
  checkerboard: "Damier",
  waves: "Vagues",
  screen: "Trame",
  stars: "Étoiles",
  collage: "Collage",
  halftone: "Demi-teinte",
};

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === "load") {
    return { past: [], present: cloneProfileCustomTheme(action.value), future: [] };
  }
  if (action.type === "commit") {
    if (JSON.stringify(action.value) === JSON.stringify(state.present)) return state;
    return {
      past: [...state.past, state.present].slice(-MAX_HISTORY),
      present: action.value,
      future: [],
    };
  }
  if (action.type === "undo" && state.past.length) {
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future].slice(0, MAX_HISTORY),
    };
  }
  if (action.type === "redo" && state.future.length) {
    return {
      past: [...state.past, state.present].slice(-MAX_HISTORY),
      present: state.future[0],
      future: state.future.slice(1),
    };
  }
  if (action.type === "reset") {
    return {
      past: [...state.past, state.present].slice(-MAX_HISTORY),
      present: upgradeProfileCustomThemeV1ToV2(cloneProfileCustomTheme()),
      future: [],
    };
  }
  return state;
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="custom-theme-editor__section" open>
      <summary>{title}</summary>
      <div className="custom-theme-editor__section-body">{children}</div>
    </details>
  );
}

function ColorControl({
  label,
  value,
  defaultValue,
  onChange,
  onPreview,
}: {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
}) {
  const applyDraft = (input: HTMLInputElement) => {
    const normalized = input.value.toUpperCase();
    if (HEX_COLOR.test(normalized)) {
      onPreview?.(normalized);
      onChange(normalized);
    }
    else input.value = value;
  };
  const applyPicker = (input: HTMLInputElement) => {
    const normalized = input.value.toUpperCase();
    if (normalized !== value && HEX_COLOR.test(normalized)) onChange(normalized);
    else onPreview?.(value);
  };
  const previewPicker = (nextValue: string) => {
    const normalized = nextValue.toUpperCase(); onPreview?.(normalized);
  };

  return (
    <div className="custom-theme-color-field">
      <label>
        <span>{label}</span>
        <input
          type="color"
          key={value}
          defaultValue={value}
          onInput={(event) => previewPicker(event.currentTarget.value)}
          onBlur={(event) => applyPicker(event.currentTarget)}
        />
        <input
          className="custom-theme-color-field__hex"
          key={value}
          defaultValue={value}
          inputMode="text"
          maxLength={7}
          aria-label={`${label}, valeur hexadécimale`}
          onInput={(event) => {
            const normalized = event.currentTarget.value.toUpperCase(); if (HEX_COLOR.test(normalized)) onPreview?.(normalized);
          }}
          onBlur={(event) => applyDraft(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyDraft(event.currentTarget);
            }
          }}
        />
      </label>
      <button
        type="button"
        className="custom-theme-editor__reset-property"
        disabled={value === defaultValue}
        onClick={() => onChange(defaultValue)}
      >
        Réinitialiser
      </button>
    </div>
  );
}

export function CustomThemeEditor() {
  const configured = isSupabaseConfigured();
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState(
    configured ? "" : "Supabase n\u2019est pas configur\u00e9 pour cet environnement.",
  );
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [mobilePanel, setMobilePanel] = useState<"settings" | "preview">("settings");
  const [previewReady, setPreviewReady] = useState(false);
  const [assetMap, setAssetMap] = useState<ProfileCustomThemeAssetMap>({});
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const [selectedSection, setSelectedSection] = useState<ProfileCustomThemeSectionId | null>(null);
  const [hoveredSection, setHoveredSection] = useState<ProfileCustomThemeSectionId | null>(null);
  const previewSession = `custom-theme-${useId().replace(/:/g, "")}`;
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: upgradeProfileCustomThemeV1ToV2(cloneProfileCustomTheme()),
    future: [],
  });
  const config = history.present;

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const loadAccount = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      if (!auth.user) {
        setAccountError("Reconnecte-toi pour ouvrir l’éditeur.");
        return;
      }
      const { data: profile } = await supabase
        .from("member_public_profiles")
        .select("username")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!active) return;
      const username =
        typeof profile?.username === "string" && profile.username.trim()
          ? profile.username
          : typeof auth.user.app_metadata.username === "string"
            ? auth.user.app_metadata.username
            : "";
      if (!username) {
        setAccountError("Aucun profil public n’est associé à ce compte.");
        return;
      }
      const displayName =
        typeof auth.user.app_metadata.display_name === "string" &&
        auth.user.app_metadata.display_name.trim()
          ? auth.user.app_metadata.display_name
          : username;
      setAccount({ username, displayName });
    };
    void loadAccount();
    return () => { active = false; };
  }, [configured]);

  const postPreview = useCallback((
    nextConfig: ProfileCustomThemeConfigV2,
    nextAssets: ProfileCustomThemeAssetMap,
  ) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(
      createCustomThemePreviewUpdateMessage(previewSession, nextConfig, nextAssets),
      window.location.origin,
    );
  }, [previewSession]);

  useEffect(() => {
    const receiveReady = (event: MessageEvent<unknown>) => {
      const ready = readTrustedCustomThemePreviewReady(event, {
        origin: window.location.origin,
        source: iframeRef.current?.contentWindow ?? null,
        sessionId: previewSession,
      });
      if (ready) {
        setPreviewReady(true);
        postPreview(config, assetMap);
        return;
      }
      const section = readTrustedCustomThemePreviewSection(event, {
        origin: window.location.origin, source: iframeRef.current?.contentWindow ?? null, sessionId: previewSession,
      });
      if (!section) return;
      if (section.interaction === "hover") setHoveredSection(section.sectionId);
      else if (section.sectionId) setSelectedSection(section.sectionId);
    };
    window.addEventListener("message", receiveReady);
    return () => window.removeEventListener("message", receiveReady);
  }, [assetMap, config, postPreview, previewSession]);

  useEffect(() => {
    // An update sent before the iframe listener exists is harmless: the READY
    // handshake below sends the latest state again. Keeping this effect independent
    // from the visual ready flag prevents late load events from freezing changes.
    postPreview(config, assetMap);
  }, [assetMap, config, postPreview]);

  const commit = (next: ProfileCustomThemeConfigV2) => {
    dispatch({ type: "commit", value: next });
  };
  const replaceConfig = useCallback((next: ProfileCustomThemeConfigV2) => {
    dispatch({ type: "load", value: normalizeProfileCustomThemeV2(next) });
  }, []);

  const updateColor = (key: keyof ProfileCustomThemeConfigV2["colors"], value: string) => {
    const next = cloneProfileCustomTheme(config);
    next.colors[key] = value;
    if (key === "page") next.backgrounds.color = value;
    commit(next);
  };

  const previewMutation = (mutate: (next: ProfileCustomThemeConfigV2) => void) => {
    const next = cloneProfileCustomTheme(config);
    mutate(next);
    postPreview(next, assetMap);
  };
  const previewColor = (key: keyof ProfileCustomThemeConfigV2["colors"], value: string) => {
    previewMutation((next) => {
      next.colors[key] = value;
      if (key === "page") next.backgrounds.color = value;
    });
  };
  const updateTypography = (
    role: CustomThemeTypographyRole,
    patch: Partial<CustomThemeTypographyToken>,
  ) => {
    const next = cloneProfileCustomTheme(config);
    next.typography[role] = { ...next.typography[role], ...patch };
    commit(next);
  };

  const selectSection = useCallback((sectionId: ProfileCustomThemeSectionId | null) => {
    setSelectedSection(sectionId);
    if (!sectionId) return;
    iframeRef.current?.contentWindow?.postMessage(
      createCustomThemePreviewFocusMessage(previewSession, sectionId, true),
      window.location.origin,
    );
  }, [previewSession]);

  useEffect(() => {
    if (!selectedSection || !previewReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      createCustomThemePreviewFocusMessage(previewSession, selectedSection, false),
      window.location.origin,
    );
  }, [previewReady, previewSession, selectedSection]);

  useEffect(() => {
    const updateFullscreenState = () => setIsPreviewFullscreen(document.fullscreenElement === previewRef.current);
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  const togglePreviewFullscreen = async () => {
    if (document.fullscreenElement === previewRef.current) await document.exitFullscreen();
    else await previewRef.current?.requestFullscreen();
  };

  const iframeWidth = viewport === "desktop" ? 1280 : viewport === "tablet" ? 768 : 390;

  if (accountError) {
    return (
      <main className="page custom-theme-editor-page">
        <Link className="back" href="/compte">← Mon compte</Link>
        <p className="account-message is-error" role="alert">{accountError}</p>
      </main>
    );
  }

  if (!account) {
    return (
      <main className="page custom-theme-editor-page" aria-busy="true">
        <p className="eyebrow">THÈME PERSONNALISÉ</p>
        <h1>Chargement de l’éditeur…</h1>
      </main>
    );
  }

  return (
    <main className="custom-theme-editor-page">
      <header className="custom-theme-editor__header">
        <div>
          <Link className="back" href="/compte">← Mon compte</Link>
          <p className="eyebrow">THÈME PERSONNALISÉ DE {account.displayName.toUpperCase()}</p>
          <h1>Compose ton univers.</h1>
          <p>Le profil garde toutes ses sections et leur ordre. Ici, tu changes uniquement leur apparence.</p>
        </div>
        <CustomThemePersistence config={config} onReplace={replaceConfig} />
      </header>

      <nav className="custom-theme-editor__toolbar" aria-label="Actions de l’éditeur" data-tutorial-anchor="history-controls">
        <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={!history.past.length}>Annuler</button>
        <button type="button" onClick={() => dispatch({ type: "redo" })} disabled={!history.future.length}>Rétablir</button>
        <button type="button" onClick={() => dispatch({ type: "reset" })}>Tout réinitialiser</button>
        <CustomThemeTutorial />
        <span aria-live="polite">{history.past.length + 1} état{history.past.length ? "s" : ""} local{history.past.length ? "aux" : ""}</span>
      </nav>

      <div className="custom-theme-editor__mobile-tabs" role="tablist" aria-label="Vue mobile">
        <button type="button" role="tab" aria-selected={mobilePanel === "settings"} onClick={() => setMobilePanel("settings")}>Réglages</button>
        <button type="button" role="tab" aria-selected={mobilePanel === "preview"} onClick={() => setMobilePanel("preview")}>Aperçu</button>
      </div>

      <div className="custom-theme-editor__workspace">
        <aside className="custom-theme-editor__settings" data-mobile-visible={mobilePanel === "settings"}>
          <CustomThemeSectionNavigation selected={selectedSection} hovered={hoveredSection} onSelect={selectSection} />
          {selectedSection ? (
            <CustomThemeSectionControls sectionId={selectedSection} config={config} onCommit={commit} />
          ) : (
            <div className="custom-theme-global-controls" data-tutorial-anchor="global-controls">
          <EditorSection title="S’inspirer de…">
            <p className="custom-theme-editor__hint">Une inspiration applique des tokens apparentés ; elle ne copie jamais le thème source.</p>
            <div className="custom-theme-inspirations">
              {customThemeInspirations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={config.inspirationSourceThemeId === item.id ? "is-selected" : ""}
                  aria-pressed={config.inspirationSourceThemeId === item.id}
                  onClick={() => commit(applyCustomThemeInspiration(item.id, config))}
                >
                  <span>{item.palette.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>
                  <b>{item.label}</b>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
          </EditorSection>

          <div data-tutorial-anchor="background-controls"><EditorSection title="Fond">
            <label className="custom-theme-field">
              <span>Type de fond</span>
              <select
                value={config.backgrounds.mode}
                onChange={(event) => {
                  const next = cloneProfileCustomTheme(config);
                  next.backgrounds.mode = event.target.value as "solid" | "gradient" | "pattern" | "image";
                  commit(next);
                }}
              >
                <option value="solid">Couleur unie</option>
                <option value="gradient">Dégradé</option>
                <option value="pattern">Motif</option>
                <option value="image">Image priv&#233;e</option>
              </select>
            </label>
            <ColorControl label="Couleur du fond" value={config.backgrounds.color} defaultValue={defaultProfileCustomTheme.backgrounds.color} onPreview={(value) => previewMutation((next) => { next.backgrounds.color = value; next.colors.page = value; })} onChange={(value) => {
              const next = cloneProfileCustomTheme(config); next.backgrounds.color = value; next.colors.page = value; commit(next);
            }} />
            {config.backgrounds.mode === "gradient" ? (
              <>
                <ColorControl label="Départ" value={config.backgrounds.gradient.from} defaultValue={defaultProfileCustomTheme.backgrounds.gradient.from} onPreview={(value) => previewMutation((next) => { next.backgrounds.gradient.from = value; })} onChange={(value) => { const next = cloneProfileCustomTheme(config); next.backgrounds.gradient.from = value; commit(next); }} />
                <ColorControl label="Arrivée" value={config.backgrounds.gradient.to} defaultValue={defaultProfileCustomTheme.backgrounds.gradient.to} onPreview={(value) => previewMutation((next) => { next.backgrounds.gradient.to = value; })} onChange={(value) => { const next = cloneProfileCustomTheme(config); next.backgrounds.gradient.to = value; commit(next); }} />
                <label className="custom-theme-field"><span>Angle · {config.backgrounds.gradient.angle}°</span><input type="range" min="0" max="360" value={config.backgrounds.gradient.angle} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.gradient.angle = Number(event.target.value); commit(next); }} /></label>
              </>
            ) : null}
            {config.backgrounds.mode === "pattern" ? (
              <>
                <label className="custom-theme-field"><span>Motif</span><select value={config.backgrounds.pattern.kind} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.pattern.kind = event.target.value as CustomThemePatternKind; commit(next); }}>{customThemePatternKinds.map((kind) => <option key={kind} value={kind}>{patternLabels[kind]}</option>)}</select></label>
                <ColorControl label="Couleur du motif" value={config.backgrounds.pattern.color} defaultValue={defaultProfileCustomTheme.backgrounds.pattern.color} onPreview={(value) => previewMutation((next) => { next.backgrounds.pattern.color = value; })} onChange={(value) => { const next = cloneProfileCustomTheme(config); next.backgrounds.pattern.color = value; commit(next); }} />
                <label className="custom-theme-field"><span>Échelle · {config.backgrounds.pattern.scale}px</span><input type="range" min="8" max="120" value={config.backgrounds.pattern.scale} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.pattern.scale = Number(event.target.value); commit(next); }} /></label>
                <label className="custom-theme-field"><span>Opacité · {Math.round(config.backgrounds.pattern.opacity * 100)}%</span><input type="range" min="0" max="0.5" step="0.01" value={config.backgrounds.pattern.opacity} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.pattern.opacity = Number(event.target.value); commit(next); }} /></label>
              </>
            ) : null}
          </EditorSection></div>

          <div data-tutorial-anchor="asset-controls"><EditorSection title="Images et d&#233;corations">
            <p className="custom-theme-editor__hint">Les images restent priv&#233;es tant qu&#39;un th&#232;me n&#39;est pas publi&#233;. Elles ne peuvent occuper que les emplacements s&#251;rs pr&#233;vus par le site.</p>
            <CustomThemeAssets config={config} onCommit={commit} onAssetMapChange={setAssetMap} />
          </EditorSection></div>

          <EditorSection title="Couleurs">
            <div className="custom-theme-colors">
              {colorFields.map(([key, label]) => (
                <ColorControl key={key} label={label} value={config.colors[key]} defaultValue={defaultProfileCustomTheme.colors[key]} onPreview={(value) => previewColor(key, value)} onChange={(value) => updateColor(key, value)} />
              ))}
            </div>
          </EditorSection>

          <div data-tutorial-anchor="typography-controls"><EditorSection title="Polices">
            <div className="custom-theme-typography">
              {customThemeTypographyRoles.map((role) => {
                const token = config.typography[role];
                return (
                  <fieldset key={role}>
                    <legend>{typographyLabels[role]}</legend>
                    <label className="custom-theme-field"><span>Famille</span><select value={token.family} onChange={(event) => updateTypography(role, { family: event.target.value as CustomThemeFontFamily })}>{customThemeFontFamilies.map((family) => <option key={family} value={family}>{fontLabels[family]}</option>)}</select></label>
                    <label className="custom-theme-field"><span>Taille · {token.size}px</span><input type="range" min={role === "display" ? 24 : role === "stat" ? 24 : role === "label" || role === "button" ? 10 : 13} max={role === "display" ? 96 : role === "stat" ? 72 : role === "body" ? 24 : role === "label" ? 18 : 20} value={token.size} onChange={(event) => updateTypography(role, { size: Number(event.target.value) })} /></label>
                    <label className="custom-theme-field"><span>Graisse</span><select value={token.weight} onChange={(event) => updateTypography(role, { weight: Number(event.target.value) as CustomThemeTypographyToken["weight"] })}>{[400, 500, 600, 700, 800].map((weight) => <option key={weight} value={weight}>{weight}</option>)}</select></label>
                    <label className="custom-theme-field"><span>Interlettrage · {token.letterSpacing.toFixed(2)}em</span><input type="range" min="-0.05" max="0.2" step="0.01" value={token.letterSpacing} onChange={(event) => updateTypography(role, { letterSpacing: Number(event.target.value) })} /></label>
                    <label className="custom-theme-field"><span>Hauteur de ligne · {token.lineHeight.toFixed(2)}</span><input type="range" min="0.9" max="1.9" step="0.05" value={token.lineHeight} onChange={(event) => updateTypography(role, { lineHeight: Number(event.target.value) })} /></label>
                    <label className="custom-theme-field"><span>Casse</span><select value={token.transform} onChange={(event) => updateTypography(role, { transform: event.target.value as CustomThemeTypographyToken["transform"] })}><option value="none">Normale</option><option value="uppercase">MAJUSCULES</option><option value="lowercase">minuscules</option></select></label>
                    <label className="custom-theme-check"><input type="checkbox" checked={token.italic} onChange={(event) => updateTypography(role, { italic: event.target.checked })} /><span>Italique</span></label>
                    <button type="button" className="custom-theme-editor__reset-property" disabled={JSON.stringify(token) === JSON.stringify(defaultProfileCustomTheme.typography[role])} onClick={() => updateTypography(role, defaultProfileCustomTheme.typography[role])}>Réinitialiser cette police</button>
                  </fieldset>
                );
              })}
            </div>
          </EditorSection></div>

          <div data-tutorial-anchor="card-controls"><EditorSection title="Cartes et cadres">
            <p className="custom-theme-editor__hint">Tu modifies seulement la finition. Les grilles, l’ordre, la taille des colonnes et le contenu restent imposés par le site.</p>
            {(["album", "track"] as const).map((cardType) => {
              const target = cardType === "album" ? "albumCard" : "trackCard";
              const label = cardType === "album" ? "Albums" : "Morceaux";
              const card = config.cards[cardType];
              return (
                <fieldset className="custom-theme-card-controls" key={cardType}>
                  <legend>{label}</legend>
                  <label className="custom-theme-field"><span>Coins des cartes et jaquettes · {config.radii[target]} px</span><input type="range" min="0" max="32" value={config.radii[target]} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.radii[target] = Number(event.target.value); commit(next); }} /></label>
                  <label className="custom-theme-field"><span>Cadre de la jaquette</span><select value={card.imageFrame} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.cards[cardType].imageFrame = event.target.value as "none" | "line" | "double"; commit(next); }}><option value="none">Sans cadre</option><option value="line">Trait simple</option><option value="double">Double trait</option></select></label>
                  <ColorControl key={cardType} label="Fond de la carte" value={card.background} defaultValue={defaultProfileCustomTheme.cards[cardType].background} onPreview={(value) => previewMutation((next) => { next.cards[cardType].background = value; })} onChange={(value) => { const next = cloneProfileCustomTheme(config); next.cards[cardType].background = value; commit(next); }} />
                  <label className="custom-theme-field"><span>Mouvement au survol</span><select value={card.hover} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.cards[cardType].hover = event.target.value as "none" | "lift" | "zoom" | "glow"; commit(next); }}><option value="none">Aucun</option><option value="lift">Soulèvement</option><option value="zoom">Zoom léger</option><option value="glow">Halo</option></select></label>
                  <label className="custom-theme-field"><span>Inclinaison · {card.rotation.toFixed(1)}°</span><input type="range" min="-3" max="3" step="0.5" value={card.rotation} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.cards[cardType].rotation = Number(event.target.value); commit(next); }} /></label>
                  <button type="button" className="custom-theme-editor__reset-property" onClick={() => { const next = cloneProfileCustomTheme(config); next.cards[cardType] = cloneProfileCustomTheme().cards[cardType]; next.radii[target] = cloneProfileCustomTheme().radii[target]; commit(next); }}>Réinitialiser ces cadres</button>
                </fieldset>
              );
            })}
          </EditorSection></div>

          <div data-tutorial-anchor="motion-controls"><EditorSection title="Mouvements">
            <CustomThemeMotion config={config} onCommit={commit} />
          </EditorSection></div>
            </div>
          )}
        </aside>

        <section ref={previewRef} className="custom-theme-editor__preview" data-mobile-visible={mobilePanel === "preview"} aria-label="Aperçu réel du profil" data-tutorial-anchor="preview">
          <div className="custom-theme-editor__preview-bar">
            <div role="group" aria-label="Largeur de l’aperçu">
              {(["desktop", "tablet", "mobile"] as const).map((size) => (
                <button key={size} type="button" className={viewport === size ? "is-selected" : ""} aria-pressed={viewport === size} onClick={() => setViewport(size)}>{size === "desktop" ? "Ordinateur" : size === "tablet" ? "Tablette" : "Mobile"}</button>
              ))}
            </div>
            <div className="custom-theme-editor__preview-status">
              <span>{iframeWidth}px · {previewReady ? "APERÇU SYNCHRONISÉ" : "CHARGEMENT"}</span>
              <button type="button" onClick={() => void togglePreviewFullscreen()}>{isPreviewFullscreen ? "Quitter le plein écran" : "Plein écran"}</button>
            </div>
          </div>
          <div className="custom-theme-editor__preview-canvas">
            <iframe
              ref={iframeRef}
              title="Aperçu réel du thème personnalisé"
              style={{ width: iframeWidth }}
              src={`/membres/${encodeURIComponent(account.username)}?previewTheme=custom&profilePreview=1&previewSession=${encodeURIComponent(previewSession)}`}
              onLoad={() => {
                postPreview(config, assetMap);
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
