import {
  customThemeBoxTargets,
  type CustomThemeBorderToken,
  type CustomThemeBoxTarget,
  type CustomThemeShadowToken,
  type ProfileCustomThemeConfigV1,
} from "@/lib/profile-custom-theme/types";

function targetRecord<T>(factory: (target: CustomThemeBoxTarget) => T) {
  return Object.fromEntries(
    customThemeBoxTargets.map((target) => [target, factory(target)]),
  ) as Record<CustomThemeBoxTarget, T>;
}

const defaultBorder = (): CustomThemeBorderToken => ({
  width: 1,
  style: "solid",
  color: "#183650",
});

const defaultShadow = (): CustomThemeShadowToken => ({
  kind: "hard",
  x: 4,
  y: 4,
  blur: 0,
  spread: 0,
  color: "#183650",
});

export const defaultProfileCustomTheme: ProfileCustomThemeConfigV1 = {
  schemaVersion: 1,
  inspirationSourceThemeId: null,
  colors: {
    page: "#F5F1E8",
    surface: "#FFFDF7",
    surfaceAlt: "#C8E7FF",
    text: "#183650",
    mutedText: "#566978",
    accent: "#CCF51D",
    accentAlt: "#ED4933",
    title: "#183650",
    border: "#183650",
    link: "#1649D8",
    buttonBackground: "#183650",
    buttonText: "#FFFFFF",
    badgeBackground: "#CCF51D",
    badgeText: "#183650",
    statBackground: "#C8E7FF",
    statText: "#183650",
    separator: "#ED4933",
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
    color: "#F5F1E8",
    gradient: { from: "#F5F1E8", to: "#C8E7FF", angle: 135 },
    pattern: { kind: "none", color: "#183650", scale: 24, opacity: 0.12, rotation: 0 },
    image: { assetId: null, opacity: 0.4, position: "center", size: "cover", repeat: "no-repeat", brightness: 1, contrast: 1, blur: 0 },
    overlay: { color: "#F5F1E8", opacity: 0 },
  },
  borders: targetRecord(defaultBorder),
  radii: targetRecord((target) => target === "button" || target === "badge" ? 0 : 8),
  shadows: targetRecord(defaultShadow),
  cards: {
    album: { background: "#FFFDF7", textAlign: "left", titleScale: 1, imageFrame: "line", badgeStyle: "square", hover: "lift", rotation: 0 },
    track: { background: "#FFFDF7", textAlign: "left", titleScale: 1, imageFrame: "line", badgeStyle: "square", hover: "lift", rotation: 0 },
  },
  headings: { align: "left", separator: "line", background: "#FFFDF7", shadow: "none" },
  buttons: { preset: "brutalist", hover: "lift", click: "press" },
  avatar: { shape: "square", size: 144, background: "#C8E7FF", borderWidth: 2, borderColor: "#183650", shadow: "hard" },
  stats: { variant: "grid" },
  podium: { shape: "circle", frame: "line", gold: "#D3A735", silver: "#AAB4BD", bronze: "#B67544" },
  video: { spacing: 18 },
  decorations: [],
  motion: { entrance: "fade", hover: "lift", link: "underline", counter: "none", duration: 220 },
};

export function cloneProfileCustomTheme(
  source: ProfileCustomThemeConfigV1 = defaultProfileCustomTheme,
) {
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
