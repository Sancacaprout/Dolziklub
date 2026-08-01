import {
  customThemeBoxTargets,
  type CustomThemeBorderToken,
  type CustomThemeBoxTarget,
  type CustomThemeShadowToken,
  type ProfileCustomThemeConfigV1,
} from "@/lib/profile-custom-theme/types";
import type { ProfileCustomThemeConfig } from "@/lib/profile-custom-theme/sections";

function targetRecord<T>(factory: (target: CustomThemeBoxTarget) => T) {
  return Object.fromEntries(
    customThemeBoxTargets.map((target) => [target, factory(target)]),
  ) as Record<CustomThemeBoxTarget, T>;
}

const defaultBorder = (): CustomThemeBorderToken => ({
  width: 1,
  style: "solid",
  color: "#171715",
});

const defaultShadow = (): CustomThemeShadowToken => ({
  kind: "none",
  x: 0,
  y: 0,
  blur: 12,
  spread: 0,
  color: "#171715",
});

export const defaultProfileCustomTheme: ProfileCustomThemeConfigV1 = {
  schemaVersion: 1,
  inspirationSourceThemeId: null,
  colors: {
    page: "#F4F0E7",
    surface: "#FFFDF7",
    surfaceAlt: "#ECE7DA",
    text: "#171715",
    mutedText: "#5C5A54",
    accent: "#E14832",
    accentAlt: "#2148E8",
    title: "#171715",
    border: "#171715",
    link: "#2148E8",
    buttonBackground: "#E14832",
    buttonText: "#FFFFFF",
    badgeBackground: "#E14832",
    badgeText: "#FFFFFF",
    statBackground: "#D6F522",
    statText: "#171715",
    separator: "#171715",
  },
  typography: {
    display: { family: "space-grotesk", size: 56, weight: 700, letterSpacing: -0.03, lineHeight: 1.02, transform: "none", italic: false },
    body: { family: "space-grotesk", size: 17, weight: 400, letterSpacing: 0, lineHeight: 1.55, transform: "none", italic: false },
    label: { family: "dm-mono", size: 12, weight: 500, letterSpacing: 0.08, lineHeight: 1.3, transform: "uppercase", italic: false },
    button: { family: "dm-mono", size: 13, weight: 500, letterSpacing: 0.04, lineHeight: 1.2, transform: "uppercase", italic: false },
    stat: { family: "space-grotesk", size: 38, weight: 700, letterSpacing: -0.02, lineHeight: 1, transform: "none", italic: false },
  },
  backgrounds: {
    mode: "solid",
    color: "#F4F0E7",
    gradient: { from: "#F4F0E7", to: "#ECE7DA", angle: 135 },
    pattern: { kind: "none", color: "#171715", scale: 24, opacity: 0.12, rotation: 0 },
    image: { assetId: null, opacity: 0.4, position: "center", size: "cover", repeat: "no-repeat", brightness: 1, contrast: 1, blur: 0 },
    overlay: { color: "#F4F0E7", opacity: 0 },
  },
  borders: targetRecord(defaultBorder),
  radii: targetRecord(() => 0),
  shadows: targetRecord(defaultShadow),
  cards: {
    album: { background: "#FFFDF7", textAlign: "left", titleScale: 1, imageFrame: "line", badgeStyle: "square", hover: "none", rotation: 0 },
    track: { background: "#FFFDF7", textAlign: "left", titleScale: 1, imageFrame: "line", badgeStyle: "square", hover: "none", rotation: 0 },
  },
  headings: { align: "left", separator: "line", background: "#FFFDF7", shadow: "none" },
  buttons: { preset: "brutalist", hover: "none", click: "press" },
  avatar: { shape: "circle", size: 144, background: "#E14832", borderWidth: 2, borderColor: "#171715", shadow: "none" },
  stats: { variant: "grid" },
  podium: { shape: "circle", frame: "line", gold: "#D3A735", silver: "#AAB4BD", bronze: "#B67544" },
  video: { spacing: 0 },
  decorations: [],
  motion: { entrance: "none", hover: "none", link: "none", counter: "none", duration: 220 },
};

export function cloneProfileCustomTheme<T extends ProfileCustomThemeConfig = ProfileCustomThemeConfigV1>(
  source: T = defaultProfileCustomTheme as T,
): T {
  return structuredClone(source);
}

export function resetProfileCustomThemeSection<K extends keyof ProfileCustomThemeConfigV1>(
  source: ProfileCustomThemeConfigV1,
  key: K,
) {
  const next = cloneProfileCustomTheme(source);
  next[key] = cloneProfileCustomTheme(defaultProfileCustomTheme)[key];
  return next;
}
