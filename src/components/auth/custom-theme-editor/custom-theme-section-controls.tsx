"use client";

import {
  cloneProfileCustomThemeV2,
  customThemeFontFamilies,
  defaultProfileCustomTheme,
  upgradeProfileCustomThemeV1ToV2,
  type CustomThemeFontFamily,
  type ProfileCustomThemeConfigV2,
  type ProfileCustomThemeSectionId,
} from "@/lib/profile-custom-theme";

export const customThemeSectionLabels: Record<ProfileCustomThemeSectionId, string> = {
  identity: "En-tête et identité",
  quiz: "Ce qui me fait tendre l’oreille",
  favoriteAlbums: "Mes 3 albums préférés",
  favoriteTracks: "Mes 3 musiques préférées",
  favoriteArtists: "Mes 3 artistes préférés",
  favoriteClip: "Mon clip préféré",
  stats: "Statistiques",
  listened: "Albums écoutés",
  proposed: "Albums proposés",
  bonus: "Écoutes bonus",
};

const sectionGroups = [
  { label: "Identité", ids: ["identity", "quiz"] },
  { label: "Favoris", ids: ["favoriteAlbums", "favoriteTracks", "favoriteArtists", "favoriteClip"] },
  { label: "Activité", ids: ["stats", "listened", "proposed", "bonus"] },
] as const satisfies ReadonlyArray<{ label: string; ids: readonly ProfileCustomThemeSectionId[] }>;

const fontLabels: Record<CustomThemeFontFamily, string> = {
  "space-grotesk": "Space Grotesk", "dm-mono": "DM Mono", "system-sans": "Sans-serif système",
  "system-serif": "Serif système", "editorial-serif": "Serif éditoriale", "humanist-sans": "Sans humaniste",
  "condensed-sans": "Sans condensée", "rounded-sans": "Sans arrondie", typewriter: "Machine à écrire", poster: "Affiche épaisse",
};

const cardSections = new Set<ProfileCustomThemeSectionId>([
  "favoriteAlbums", "favoriteTracks", "favoriteArtists", "listened", "proposed", "bonus",
]);

export function CustomThemeSectionNavigation({
  selected,
  hovered,
  onSelect,
}: {
  selected: ProfileCustomThemeSectionId | null;
  hovered: ProfileCustomThemeSectionId | null;
  onSelect: (sectionId: ProfileCustomThemeSectionId | null) => void;
}) {
  return (
    <nav className="custom-theme-section-nav" aria-label="Section du profil à modifier" data-tutorial-anchor="section-navigation">
      <button type="button" className={selected === null ? "is-selected" : ""} aria-pressed={selected === null} onClick={() => onSelect(null)}>
        <b>Réglages généraux</b><span>Fond, palette, polices, images et mouvements</span>
      </button>
      {sectionGroups.map((group) => (
        <div key={group.label}>
          <p>{group.label}</p>
          {group.ids.map((sectionId) => (
            <button
              key={sectionId}
              type="button"
              className={selected === sectionId ? "is-selected" : hovered === sectionId ? "is-hovered" : ""}
              aria-pressed={selected === sectionId}
              onClick={() => onSelect(sectionId)}
            >
              {customThemeSectionLabels[sectionId]}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="custom-theme-field"><span>{label}</span><input type="color" value={value} onChange={(event) => onChange(event.currentTarget.value.toUpperCase())} /></label>;
}

export function CustomThemeSectionControls({
  sectionId,
  config,
  onCommit,
}: {
  sectionId: ProfileCustomThemeSectionId;
  config: ProfileCustomThemeConfigV2;
  onCommit: (config: ProfileCustomThemeConfigV2) => void;
}) {
  const section = config.sections[sectionId];
  const update = (mutate: (next: ProfileCustomThemeConfigV2["sections"][ProfileCustomThemeSectionId]) => void) => {
    const next = cloneProfileCustomThemeV2(config);
    mutate(next.sections[sectionId]);
    onCommit(next);
  };
  const boxControls = (kind: "surface" | "card" | "cover" | "copy", title: string) => {
    const box = section[kind];
    return <fieldset className="custom-theme-card-controls" data-control-group={kind}><legend>{title}</legend>
      <ColorField label="Fond" value={box.background} onChange={(value) => update((target) => { target[kind].background = value; })} />
      <ColorField label="Couleur de bordure" value={box.border.color} onChange={(value) => update((target) => { target[kind].border.color = value; })} />
      <label className="custom-theme-field"><span>Style de bordure</span><select value={box.border.style} onChange={(event) => update((target) => { target[kind].border.style = event.target.value as typeof box.border.style; })}><option value="none">Aucune</option><option value="solid">Trait simple</option><option value="double">Double</option><option value="dashed">Pointillés</option></select></label>
      <label className="custom-theme-field"><span>Épaisseur · {box.border.width}px</span><input type="range" min="0" max="6" value={box.border.width} onChange={(event) => update((target) => { target[kind].border.width = Number(event.target.value); })} /></label>
      <label className="custom-theme-field"><span>Rayon · {box.radius}px</span><input type="range" min="0" max="48" value={box.radius} onChange={(event) => update((target) => { target[kind].radius = Number(event.target.value); })} /></label>
      <label className="custom-theme-field"><span>Padding · {box.padding}px</span><input type="range" min="0" max="48" value={box.padding} onChange={(event) => update((target) => { target[kind].padding = Number(event.target.value); })} /></label>
      <label className="custom-theme-field"><span>Ombre</span><select value={box.shadow.kind} onChange={(event) => update((target) => { target[kind].shadow.kind = event.target.value as typeof box.shadow.kind; })}><option value="none">Aucune</option><option value="soft">Douce</option><option value="hard">Franche</option><option value="glow">Halo</option></select></label>
    </fieldset>;
  };
  const textControls = (kind: "heading" | "titleText" | "secondaryText", title: string) => {
    const token = section[kind];
    return <fieldset className="custom-theme-card-controls" data-control-group={kind}><legend>{title}</legend>
      <ColorField label="Couleur" value={token.color} onChange={(value) => update((target) => { target[kind].color = value; })} />
      <label className="custom-theme-field"><span>Police</span><select value={token.family} onChange={(event) => update((target) => { target[kind].family = event.target.value as CustomThemeFontFamily; })}>{customThemeFontFamilies.map((family) => <option key={family} value={family}>{fontLabels[family]}</option>)}</select></label>
      <label className="custom-theme-field"><span>Taille · {token.size}px</span><input type="range" min="10" max="96" value={token.size} onChange={(event) => update((target) => { target[kind].size = Number(event.target.value); })} /></label>
      <label className="custom-theme-field"><span>Graisse</span><select value={token.weight} onChange={(event) => update((target) => { target[kind].weight = Number(event.target.value) as typeof token.weight; })}>{[400, 500, 600, 700, 800].map((weight) => <option key={weight} value={weight}>{weight}</option>)}</select></label>
    </fieldset>;
  };
  return (
    <section className="custom-theme-section-controls" aria-labelledby="custom-theme-selected-section" data-tutorial-anchor="section-controls">
      <header><p className="eyebrow">SECTION SÉLECTIONNÉE</p><h2 id="custom-theme-selected-section">{customThemeSectionLabels[sectionId]}</h2><p>Seuls les réglages de cette zone sont affichés. Le reste du profil ne bouge pas.</p></header>
      {boxControls("surface", "Cadre global de la section")}
      {textControls("heading", "Titre de section")}
      {cardSections.has(sectionId) ? <>{boxControls("card", "Cartes")}{boxControls("cover", "Images et jaquettes")}{boxControls("copy", "Zone texte")}{textControls("titleText", "Titre de la carte")}{textControls("secondaryText", "Texte secondaire")}</> : null}
      <button type="button" className="custom-theme-editor__reset-property" onClick={() => {
        const next = cloneProfileCustomThemeV2(config);
        next.sections[sectionId] = structuredClone(upgradeProfileCustomThemeV1ToV2(defaultProfileCustomTheme).sections[sectionId]);
        onCommit(next);
      }}>Réinitialiser cette section</button>
    </section>
  );
}
