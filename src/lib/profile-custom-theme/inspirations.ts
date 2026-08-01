import { cloneProfileCustomTheme, defaultProfileCustomTheme } from "@/lib/profile-custom-theme/defaults";
import type {
  CustomThemeFontFamily,
  CustomThemeInspirationId,
  CustomThemePatternKind,
} from "@/lib/profile-custom-theme/types";
import type { ProfileCustomThemeConfig } from "@/lib/profile-custom-theme/sections";

export type CustomThemeInspiration = {
  id: CustomThemeInspirationId;
  label: string;
  description: string;
  palette: readonly [string, string, string, string, string];
  pattern: CustomThemePatternKind;
  displayFont: CustomThemeFontFamily;
  bodyFont: CustomThemeFontFamily;
  radius: number;
  shadow: "none" | "soft" | "hard" | "glow";
};

const inspiration = (
  id: CustomThemeInspirationId,
  label: string,
  description: string,
  palette: CustomThemeInspiration["palette"],
  pattern: CustomThemePatternKind,
  displayFont: CustomThemeFontFamily,
  bodyFont: CustomThemeFontFamily,
  radius: number,
  shadow: CustomThemeInspiration["shadow"],
): CustomThemeInspiration => ({ id, label, description, palette, pattern, displayFont, bodyFont, radius, shadow });

export const customThemeInspirations: readonly CustomThemeInspiration[] = [
  inspiration("dol-ziklub", "DOL ZIKLUB", "Clair, bleu club et accent citron.", ["#F5F1E8", "#FFFDF7", "#183650", "#CCF51D", "#ED4933"], "grid", "space-grotesk", "space-grotesk", 8, "hard"),
  inspiration("archive", "Archive", "Papier chaud, encre et tampon.", ["#E9DFC8", "#F7F0DF", "#30291F", "#A83A2A", "#D8C9AA"], "paper", "dm-mono", "system-serif", 2, "hard"),
  inspiration("dark-vinyl", "Dark Vinyl", "Studio sombre et cuivre brûlé.", ["#121211", "#24231F", "#EEE8DA", "#B64A2D", "#716A5E"], "vinyl", "space-grotesk", "space-grotesk", 12, "soft"),
  inspiration("fanzine", "Fanzine", "Photocopie, rouge frontal et collage.", ["#F5F0DF", "#FFFFFF", "#0B0B0B", "#E1261C", "#B7B0A0"], "collage", "dm-mono", "system-sans", 0, "hard"),
  inspiration("neon-club", "Neon Club", "Bleu nuit, violet et rose électrique.", ["#10122D", "#1D2048", "#F8F7FF", "#FB4FE5", "#6D5BFF"], "grid", "space-grotesk", "space-grotesk", 16, "glow"),
  inspiration("natural-tape", "Natural Tape", "Carton, olive et collection intime.", ["#E9DFC9", "#F2E9D7", "#3B392A", "#7B8350", "#B1A17E"], "paper", "system-serif", "space-grotesk", 10, "soft"),
  inspiration("chrome-2000", "Chrome 2000", "Chrome clair et bleu lecteur Y2K.", ["#EAF4FF", "#FFFFFF", "#101B2E", "#1377FF", "#88A8C5"], "grid", "space-grotesk", "system-sans", 14, "soft"),
  inspiration("city-pop", "City Pop", "Nuit marine et coucher de soleil rose.", ["#15254D", "#233765", "#FFF7E8", "#FA94AE", "#F9C56E"], "waves", "space-grotesk", "space-grotesk", 18, "glow"),
  inspiration("punk-poster", "Punk Poster", "Affiche noire, blanche et rouge.", ["#F6F3EB", "#FFFFFF", "#090909", "#EF2720", "#8D8A84"], "halftone", "dm-mono", "system-sans", 0, "hard"),
  inspiration("jazz-lounge", "Jazz Lounge", "Bordeaux, crème et or discret.", ["#3C101B", "#5B1B2A", "#F4E7D1", "#C9A35C", "#8E6670"], "grain", "system-serif", "system-serif", 14, "soft"),
  inspiration("acid-rave", "Acid Rave", "Noir technique et vert fluorescent.", ["#111312", "#20251F", "#F2F4EE", "#C8FF00", "#F4F500"], "screen", "dm-mono", "system-sans", 0, "glow"),
  inspiration("wheely", "Wheely", "Arcade vinyle et vert score.", ["#111111", "#222222", "#F4EFE4", "#B5F50D", "#2148E8"], "checkerboard", "dm-mono", "space-grotesk", 0, "hard"),
  inspiration("noir-cinema", "Noir Cinéma", "Salle obscure, velours et générique doré.", ["#090909", "#171312", "#F0E9DB", "#A71924", "#C7A96B"], "grain", "system-serif", "space-grotesk", 2, "soft"),
  inspiration("manga-panel", "Manga Panel", "Papier, encre et trame rouge.", ["#FAF8F0", "#FFFFFF", "#090909", "#E3312D", "#B8B5AE"], "halftone", "dm-mono", "system-sans", 0, "hard"),
  inspiration("cassette-sunset", "Cassette Sunset", "Violet mixtape et orange couchant.", ["#24153D", "#3D2357", "#F6D3A2", "#F36B46", "#ECA85D"], "lines", "dm-mono", "space-grotesk", 12, "glow"),
  inspiration("museum-white", "Museum White", "Galerie blanche et cartels fins.", ["#F8F6F0", "#FFFFFF", "#171717", "#9B2B27", "#B7B4AC"], "none", "system-serif", "system-sans", 0, "none"),
] as const;

export function applyCustomThemeInspiration<T extends ProfileCustomThemeConfig = ProfileCustomThemeConfig>(
  inspirationId: CustomThemeInspirationId,
  source: T = defaultProfileCustomTheme as T,
) {
  const selected = customThemeInspirations.find((item) => item.id === inspirationId);
  if (!selected) return cloneProfileCustomTheme(source);
  const next = cloneProfileCustomTheme(source);
  const [page, surface, text, accent, secondary] = selected.palette;
  next.inspirationSourceThemeId = selected.id;
  next.colors = {
    ...next.colors,
    page,
    surface,
    surfaceAlt: secondary,
    text,
    mutedText: secondary,
    accent,
    accentAlt: secondary,
    title: text,
    border: text,
    link: accent,
    buttonBackground: text,
    buttonText: surface,
    badgeBackground: accent,
    badgeText: text,
    statBackground: secondary,
    statText: text,
    separator: accent,
  };
  next.backgrounds.color = page;
  next.backgrounds.gradient = { from: page, to: secondary, angle: 135 };
  next.backgrounds.pattern = { ...next.backgrounds.pattern, kind: selected.pattern, color: text };
  next.typography.display.family = selected.displayFont;
  next.typography.body.family = selected.bodyFont;
  for (const target of Object.keys(next.radii) as Array<keyof typeof next.radii>) {
    next.radii[target] = selected.radius;
    next.borders[target].color = text;
    next.shadows[target] = {
      ...next.shadows[target],
      kind: selected.shadow,
      color: selected.shadow === "glow" ? accent : text,
    };
  }
  next.cards.album.background = surface;
  next.cards.track.background = surface;
  next.headings.background = surface;
  next.avatar.background = secondary;
  next.avatar.borderColor = text;
  return next;
}
