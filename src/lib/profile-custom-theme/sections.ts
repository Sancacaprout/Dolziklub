import type {
  CustomThemeBorderToken,
  CustomThemeBoxTarget,
  CustomThemeFontFamily,
  CustomThemeShadowToken,
  ProfileCustomThemeConfigV1,
} from "@/lib/profile-custom-theme/types";

export const CUSTOM_THEME_SCHEMA_VERSION_V2 = 2 as const;

export const customThemeSectionIds = [
  "identity",
  "quiz",
  "favoriteAlbums",
  "favoriteTracks",
  "favoriteArtists",
  "favoriteClip",
  "stats",
  "listened",
  "proposed",
  "bonus",
] as const;

export type ProfileCustomThemeSectionId = (typeof customThemeSectionIds)[number];

export type CustomThemeSectionBoxToken = {
  background: string;
  border: CustomThemeBorderToken;
  radius: number;
  shadow: CustomThemeShadowToken;
  padding: number;
};

export type CustomThemeSectionTextToken = {
  family: CustomThemeFontFamily;
  size: number;
  weight: 400 | 500 | 600 | 700 | 800;
  color: string;
  transform: "none" | "uppercase" | "lowercase";
  italic: boolean;
};

export type CustomThemeSectionStyle = {
  surface: CustomThemeSectionBoxToken;
  heading: CustomThemeSectionTextToken;
  card: CustomThemeSectionBoxToken;
  cover: CustomThemeSectionBoxToken;
  copy: CustomThemeSectionBoxToken;
  titleText: CustomThemeSectionTextToken;
  secondaryText: CustomThemeSectionTextToken;
};

export type ProfileCustomThemeConfigV2 = Omit<ProfileCustomThemeConfigV1, "schemaVersion"> & {
  schemaVersion: typeof CUSTOM_THEME_SCHEMA_VERSION_V2;
  sections: Record<ProfileCustomThemeSectionId, CustomThemeSectionStyle>;
};

export type ProfileCustomThemeConfig = ProfileCustomThemeConfigV1 | ProfileCustomThemeConfigV2;

const sectionTargets: Record<ProfileCustomThemeSectionId, CustomThemeBoxTarget> = {
  identity: "header",
  quiz: "quiz",
  favoriteAlbums: "albumCard",
  favoriteTracks: "trackCard",
  favoriteArtists: "podium",
  favoriteClip: "video",
  stats: "stats",
  listened: "listened",
  proposed: "proposed",
  bonus: "bonus",
};

function cloneBorder(value: CustomThemeBorderToken): CustomThemeBorderToken {
  return { ...value };
}

function cloneShadow(value: CustomThemeShadowToken): CustomThemeShadowToken {
  return { ...value };
}

function boxFrom(
  source: ProfileCustomThemeConfigV1,
  target: CustomThemeBoxTarget,
  background: string,
  padding: number,
): CustomThemeSectionBoxToken {
  return {
    background,
    border: cloneBorder(source.borders[target]),
    radius: source.radii[target],
    shadow: cloneShadow(source.shadows[target]),
    padding,
  };
}

function textFrom(
  source: ProfileCustomThemeConfigV1,
  role: "display" | "body" | "label",
  color: string,
  size?: number,
): CustomThemeSectionTextToken {
  const token = source.typography[role];
  return {
    family: token.family,
    size: size ?? token.size,
    weight: token.weight,
    color,
    transform: token.transform,
    italic: token.italic,
  };
}

function createSectionStyle(
  source: ProfileCustomThemeConfigV1,
  sectionId: ProfileCustomThemeSectionId,
): CustomThemeSectionStyle {
  const target = sectionTargets[sectionId];
  const isTrack = sectionId === "favoriteTracks";
  const cardTarget = isTrack ? "trackCard" : "albumCard";
  const cardBackground = isTrack ? source.cards.track.background : source.cards.album.background;
  return {
    surface: boxFrom(source, target, source.colors.surface, sectionId === "stats" ? 0 : 24),
    heading: textFrom(source, "display", source.colors.title, Math.min(source.typography.display.size, 64)),
    card: boxFrom(source, cardTarget, cardBackground, 0),
    cover: boxFrom(source, cardTarget, source.colors.surfaceAlt, 0),
    copy: boxFrom(source, cardTarget, cardBackground, 16),
    titleText: textFrom(source, "display", source.colors.title, Math.min(source.typography.display.size, 32)),
    secondaryText: textFrom(source, "body", source.colors.mutedText),
  };
}

export function upgradeProfileCustomThemeV1ToV2(
  source: ProfileCustomThemeConfigV1,
): ProfileCustomThemeConfigV2 {
  const sections = Object.fromEntries(
    customThemeSectionIds.map((sectionId) => [sectionId, createSectionStyle(source, sectionId)]),
  ) as Record<ProfileCustomThemeSectionId, CustomThemeSectionStyle>;
  return {
    ...structuredClone(source),
    schemaVersion: CUSTOM_THEME_SCHEMA_VERSION_V2,
    sections,
  };
}

export function normalizeProfileCustomThemeV2(
  source: ProfileCustomThemeConfig,
): ProfileCustomThemeConfigV2 {
  return source.schemaVersion === CUSTOM_THEME_SCHEMA_VERSION_V2
    ? structuredClone(source)
    : upgradeProfileCustomThemeV1ToV2(source);
}

export function cloneProfileCustomThemeV2(source: ProfileCustomThemeConfigV2) {
  return structuredClone(source);
}
