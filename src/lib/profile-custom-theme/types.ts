import type { ProfileThemeId } from "@/lib/profile-themes";

export const CUSTOM_THEME_SCHEMA_VERSION = 1 as const;
export const CUSTOM_THEME_MAX_BYTES = 64 * 1024;
export const CUSTOM_THEME_MAX_DECORATIONS = 8;

export const customThemeFontFamilies = [
  "space-grotesk",
  "dm-mono",
  "system-sans",
  "system-serif",
  "editorial-serif",
  "humanist-sans",
  "condensed-sans",
  "rounded-sans",
  "typewriter",
  "poster",
] as const;

export const customThemeTypographyRoles = [
  "display",
  "body",
  "label",
  "button",
  "stat",
] as const;

export const customThemeBoxTargets = [
  "header",
  "quiz",
  "albumCard",
  "trackCard",
  "podium",
  "video",
  "stats",
  "listened",
  "proposed",
  "bonus",
  "button",
  "badge",
] as const;

export const customThemePatternKinds = [
  "none",
  "dots",
  "grid",
  "paper",
  "grain",
  "vinyl",
  "lines",
  "checkerboard",
  "waves",
  "screen",
  "stars",
  "collage",
  "halftone",
] as const;

export const customThemeDecorationSlots = [
  "page-top-left",
  "page-top-right",
  "header-background",
  "quiz-background",
  "podium-side",
  "stats-background",
  "between-sections",
  "page-bottom",
] as const;

export type CustomThemeFontFamily = (typeof customThemeFontFamilies)[number];
export type CustomThemeTypographyRole = (typeof customThemeTypographyRoles)[number];
export type CustomThemeBoxTarget = (typeof customThemeBoxTargets)[number];
export type CustomThemePatternKind = (typeof customThemePatternKinds)[number];
export type CustomThemeDecorationSlot = (typeof customThemeDecorationSlots)[number];
export type CustomThemeInspirationId = Exclude<ProfileThemeId, "custom">;

export type CustomThemeColors = {
  page: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  mutedText: string;
  accent: string;
  accentAlt: string;
  title: string;
  border: string;
  link: string;
  buttonBackground: string;
  buttonText: string;
  badgeBackground: string;
  badgeText: string;
  statBackground: string;
  statText: string;
  separator: string;
};

export type CustomThemeTypographyToken = {
  family: CustomThemeFontFamily;
  size: number;
  weight: 400 | 500 | 600 | 700 | 800;
  letterSpacing: number;
  lineHeight: number;
  transform: "none" | "uppercase" | "lowercase";
  italic: boolean;
};

export type CustomThemeTypography = Record<
  CustomThemeTypographyRole,
  CustomThemeTypographyToken
>;

export type CustomThemeBackground = {
  mode: "solid" | "gradient" | "pattern" | "image";
  color: string;
  gradient: {
    from: string;
    to: string;
    angle: number;
  };
  pattern: {
    kind: CustomThemePatternKind;
    color: string;
    scale: number;
    opacity: number;
    rotation: number;
  };
  image: {
    assetId: string | null;
    opacity: number;
    position: "center" | "top" | "bottom" | "left" | "right";
    size: "cover" | "contain";
    repeat: "no-repeat" | "repeat";
    brightness: number;
    contrast: number;
    blur: number;
  };
  overlay: {
    color: string;
    opacity: number;
  };
};

export type CustomThemeBorderToken = {
  width: number;
  style: "none" | "solid" | "double" | "dashed";
  color: string;
};

export type CustomThemeShadowToken = {
  kind: "none" | "soft" | "hard" | "glow";
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
};

export type CustomThemeCardToken = {
  background: string;
  textAlign: "left" | "center";
  titleScale: number;
  imageFrame: "none" | "line" | "double";
  badgeStyle: "square" | "soft" | "pill";
  hover: "none" | "lift" | "zoom" | "glow";
  rotation: number;
};

export type CustomThemeDecoration = {
  id: string;
  assetId: string;
  slot: CustomThemeDecorationSlot;
  size: number;
  opacity: number;
  rotation: number;
  mirror: boolean;
  visibility: "all" | "desktop" | "mobile";
  alt: string;
};

export type ProfileCustomThemeConfigV1 = {
  schemaVersion: typeof CUSTOM_THEME_SCHEMA_VERSION;
  inspirationSourceThemeId: CustomThemeInspirationId | null;
  colors: CustomThemeColors;
  typography: CustomThemeTypography;
  backgrounds: CustomThemeBackground;
  borders: Record<CustomThemeBoxTarget, CustomThemeBorderToken>;
  radii: Record<CustomThemeBoxTarget, number>;
  shadows: Record<CustomThemeBoxTarget, CustomThemeShadowToken>;
  cards: {
    album: CustomThemeCardToken;
    track: CustomThemeCardToken;
  };
  headings: {
    align: "left" | "center";
    separator: "line" | "double" | "block" | "boxed" | "none";
    background: string;
    shadow: "none" | "soft" | "hard";
  };
  buttons: {
    preset: "brutalist" | "minimal" | "neon" | "pill" | "ticket" | "arcade" | "metal" | "paper";
    hover: "none" | "lift" | "glow" | "invert";
    click: "none" | "press" | "pulse";
  };
  avatar: {
    shape: "circle" | "square" | "rounded" | "hexagon";
    size: number;
    background: string;
    borderWidth: number;
    borderColor: string;
    shadow: "none" | "soft" | "hard" | "glow";
  };
  stats: {
    variant: "grid" | "cards" | "hud" | "bars" | "tickets" | "capsules" | "giant";
  };
  podium: {
    shape: "circle" | "square" | "rounded" | "hexagon";
    frame: "none" | "line" | "double" | "medallion";
    gold: string;
    silver: string;
    bronze: string;
  };
  video: {
    spacing: number;
  };
  decorations: CustomThemeDecoration[];
  motion: {
    entrance: "none" | "fade" | "slide";
    hover: "none" | "lift" | "zoom" | "glow";
    link: "none" | "underline";
    counter: "none" | "count";
    duration: number;
  };
};

export type ProfileCustomThemeAssetMap = Record<string, string>;

export type ProfileCustomThemeValidation<T = ProfileCustomThemeConfigV1> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; value: null; errors: string[] };
