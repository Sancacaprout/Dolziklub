"use client";

import Link from "next/link";
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
  customThemeFontFamilies,
  customThemeInspirations,
  customThemePatternKinds,
  customThemeTypographyRoles,
  defaultProfileCustomTheme,
  readTrustedCustomThemePreviewReady,
  type CustomThemeFontFamily,
  type CustomThemePatternKind,
  type CustomThemeTypographyRole,
  type CustomThemeTypographyToken,
  type ProfileCustomThemeConfigV1,
} from "@/lib/profile-custom-theme";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const MAX_HISTORY = 50;
const HEX_COLOR = /^#[0-9A-F]{6}$/i;

type Account = { username: string; displayName: string };
type HistoryState = {
  past: ProfileCustomThemeConfigV1[];
  present: ProfileCustomThemeConfigV1;
  future: ProfileCustomThemeConfigV1[];
};
type HistoryAction =
  | { type: "commit"; value: ProfileCustomThemeConfigV1 }
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
      present: cloneProfileCustomTheme(),
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
}: {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  const applyDraft = () => {
    const normalized = draft.toUpperCase();
    if (HEX_COLOR.test(normalized)) onChange(normalized);
    else setDraft(value);
  };

  return (
    <div className="custom-theme-color-field">
      <label>
        <span>{label}</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <input
          className="custom-theme-color-field__hex"
          value={draft}
          inputMode="text"
          maxLength={7}
          aria-label={`${label}, valeur hexadécimale`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={applyDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyDraft();
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewSession = `custom-theme-${useId().replace(/:/g, "")}`;
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: cloneProfileCustomTheme(),
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

  const postPreview = useCallback((nextConfig: ProfileCustomThemeConfigV1) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(
      createCustomThemePreviewUpdateMessage(previewSession, nextConfig),
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
      if (!ready) return;
      setPreviewReady(true);
      postPreview(config);
    };
    window.addEventListener("message", receiveReady);
    return () => window.removeEventListener("message", receiveReady);
  }, [config, postPreview, previewSession]);

  useEffect(() => {
    if (previewReady) postPreview(config);
  }, [config, postPreview, previewReady]);

  const commit = (next: ProfileCustomThemeConfigV1) => {
    dispatch({ type: "commit", value: next });
  };

  const updateColor = (key: keyof ProfileCustomThemeConfigV1["colors"], value: string) => {
    const next = cloneProfileCustomTheme(config);
    next.colors[key] = value;
    if (key === "page") next.backgrounds.color = value;
    commit(next);
  };

  const updateTypography = (
    role: CustomThemeTypographyRole,
    patch: Partial<CustomThemeTypographyToken>,
  ) => {
    const next = cloneProfileCustomTheme(config);
    next.typography[role] = { ...next.typography[role], ...patch };
    commit(next);
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
        <p className="custom-theme-editor__local-status" role="status">
          BROUILLON LOCAL · AUCUNE ÉCRITURE EN LIGNE
        </p>
      </header>

      <nav className="custom-theme-editor__toolbar" aria-label="Actions de l’éditeur">
        <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={!history.past.length}>Annuler</button>
        <button type="button" onClick={() => dispatch({ type: "redo" })} disabled={!history.future.length}>Rétablir</button>
        <button type="button" onClick={() => dispatch({ type: "reset" })}>Tout réinitialiser</button>
        <span aria-live="polite">{history.past.length + 1} état{history.past.length ? "s" : ""} local{history.past.length ? "aux" : ""}</span>
      </nav>

      <div className="custom-theme-editor__mobile-tabs" role="tablist" aria-label="Vue mobile">
        <button type="button" role="tab" aria-selected={mobilePanel === "settings"} onClick={() => setMobilePanel("settings")}>Réglages</button>
        <button type="button" role="tab" aria-selected={mobilePanel === "preview"} onClick={() => setMobilePanel("preview")}>Aperçu</button>
      </div>

      <div className="custom-theme-editor__workspace">
        <aside className="custom-theme-editor__settings" data-mobile-visible={mobilePanel === "settings"}>
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

          <EditorSection title="Fond">
            <label className="custom-theme-field">
              <span>Type de fond</span>
              <select
                value={config.backgrounds.mode}
                onChange={(event) => {
                  const next = cloneProfileCustomTheme(config);
                  next.backgrounds.mode = event.target.value as "solid" | "gradient" | "pattern";
                  commit(next);
                }}
              >
                <option value="solid">Couleur unie</option>
                <option value="gradient">Dégradé</option>
                <option value="pattern">Motif</option>
              </select>
            </label>
            <ColorControl key={config.backgrounds.color} label="Couleur du fond" value={config.backgrounds.color} defaultValue={defaultProfileCustomTheme.backgrounds.color} onChange={(value) => {
              const next = cloneProfileCustomTheme(config); next.backgrounds.color = value; next.colors.page = value; commit(next);
            }} />
            {config.backgrounds.mode === "gradient" ? (
              <>
                <ColorControl key={config.backgrounds.gradient.from} label="Départ" value={config.backgrounds.gradient.from} defaultValue={defaultProfileCustomTheme.backgrounds.gradient.from} onChange={(value) => { const next = cloneProfileCustomTheme(config); next.backgrounds.gradient.from = value; commit(next); }} />
                <ColorControl key={config.backgrounds.gradient.to} label="Arrivée" value={config.backgrounds.gradient.to} defaultValue={defaultProfileCustomTheme.backgrounds.gradient.to} onChange={(value) => { const next = cloneProfileCustomTheme(config); next.backgrounds.gradient.to = value; commit(next); }} />
                <label className="custom-theme-field"><span>Angle · {config.backgrounds.gradient.angle}°</span><input type="range" min="0" max="360" value={config.backgrounds.gradient.angle} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.gradient.angle = Number(event.target.value); commit(next); }} /></label>
              </>
            ) : null}
            {config.backgrounds.mode === "pattern" ? (
              <>
                <label className="custom-theme-field"><span>Motif</span><select value={config.backgrounds.pattern.kind} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.pattern.kind = event.target.value as CustomThemePatternKind; commit(next); }}>{customThemePatternKinds.map((kind) => <option key={kind} value={kind}>{patternLabels[kind]}</option>)}</select></label>
                <ColorControl key={config.backgrounds.pattern.color} label="Couleur du motif" value={config.backgrounds.pattern.color} defaultValue={defaultProfileCustomTheme.backgrounds.pattern.color} onChange={(value) => { const next = cloneProfileCustomTheme(config); next.backgrounds.pattern.color = value; commit(next); }} />
                <label className="custom-theme-field"><span>Échelle · {config.backgrounds.pattern.scale}px</span><input type="range" min="8" max="120" value={config.backgrounds.pattern.scale} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.pattern.scale = Number(event.target.value); commit(next); }} /></label>
                <label className="custom-theme-field"><span>Opacité · {Math.round(config.backgrounds.pattern.opacity * 100)}%</span><input type="range" min="0" max="0.5" step="0.01" value={config.backgrounds.pattern.opacity} onChange={(event) => { const next = cloneProfileCustomTheme(config); next.backgrounds.pattern.opacity = Number(event.target.value); commit(next); }} /></label>
              </>
            ) : null}
            <p className="custom-theme-editor__hint">Les images de fond arrivent dans la phase Assets, après la validation de Sharp sur Vercel.</p>
          </EditorSection>

          <EditorSection title="Couleurs">
            <div className="custom-theme-colors">
              {colorFields.map(([key, label]) => (
                <ColorControl key={key + config.colors[key]} label={label} value={config.colors[key]} defaultValue={defaultProfileCustomTheme.colors[key]} onChange={(value) => updateColor(key, value)} />
              ))}
            </div>
          </EditorSection>

          <EditorSection title="Polices">
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
          </EditorSection>
        </aside>

        <section className="custom-theme-editor__preview" data-mobile-visible={mobilePanel === "preview"} aria-label="Aperçu réel du profil">
          <div className="custom-theme-editor__preview-bar">
            <div role="group" aria-label="Largeur de l’aperçu">
              {(["desktop", "tablet", "mobile"] as const).map((size) => (
                <button key={size} type="button" className={viewport === size ? "is-selected" : ""} aria-pressed={viewport === size} onClick={() => setViewport(size)}>{size === "desktop" ? "Ordinateur" : size === "tablet" ? "Tablette" : "Mobile"}</button>
              ))}
            </div>
            <span>{iframeWidth}px · {previewReady ? "APERÇU SYNCHRONISÉ" : "CHARGEMENT"}</span>
          </div>
          <div className="custom-theme-editor__preview-canvas">
            <iframe
              ref={iframeRef}
              title="Aperçu réel du thème personnalisé"
              style={{ width: iframeWidth }}
              src={`/membres/${encodeURIComponent(account.username)}?previewTheme=custom&profilePreview=1&previewSession=${encodeURIComponent(previewSession)}`}
              onLoad={() => {
                setPreviewReady(false);
                postPreview(config);
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
