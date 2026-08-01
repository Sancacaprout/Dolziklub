import type { CSSProperties } from "react";
import type { CustomThemeBoxTarget, CustomThemeShadowToken, ProfileCustomThemeAssetMap } from "@/lib/profile-custom-theme/types";
import {
  customThemeSectionIds,
  type CustomThemeSectionBoxToken,
  type CustomThemeSectionTextToken,
  type ProfileCustomThemeConfig,
  type ProfileCustomThemeSectionId,
} from "@/lib/profile-custom-theme/sections";

type CustomThemeStyle = CSSProperties & Record<string, string | number>;
const fontStacks = {
  "space-grotesk": "var(--font-display), Arial, sans-serif",
  "dm-mono": "var(--font-mono), Consolas, monospace",
  "system-sans": "Arial, Helvetica, sans-serif",
  "system-serif": "Georgia, 'Times New Roman', serif",
  "editorial-serif": "Didot, 'Bodoni MT', Georgia, serif",
  "humanist-sans": "'Trebuchet MS', Verdana, sans-serif",
  "condensed-sans": "'Arial Narrow', 'Liberation Sans Narrow', Arial, sans-serif",
  "rounded-sans": "'Arial Rounded MT Bold', 'Trebuchet MS', Arial, sans-serif",
  typewriter: "'Courier New', Courier, monospace",
  poster: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
} as const;
const sectionNames = {
  identity: "identity", quiz: "quiz", favoriteAlbums: "favorite-albums",
  favoriteTracks: "favorite-tracks", favoriteArtists: "favorite-artists",
  favoriteClip: "favorite-clip", stats: "stats", listened: "listened",
  proposed: "proposed", bonus: "bonus",
} as const;

function borderValue(token: CustomThemeSectionBoxToken["border"]) {
  return token.style === "none" || token.width === 0 ? "none" : `${token.width}px ${token.style} ${token.color}`;
}
const targetNames: Record<CustomThemeBoxTarget, string> = { header: "header", quiz: "quiz", albumCard: "album-card", trackCard: "track-card", podium: "podium", video: "video", stats: "stats", listened: "listened", proposed: "proposed", bonus: "bonus", button: "button", badge: "badge" };

function shadowValue(token: CustomThemeShadowToken) {
  if (token.kind === "none") return "none";
  if (token.kind === "glow") return `0 0 ${Math.max(8, token.blur)}px ${token.color}`;
  return `${token.x}px ${token.y}px ${token.kind === "hard" ? 0 : token.blur}px ${token.spread}px ${token.color}`;
}

function safeAssetImage(assetId: string | null, assets: ProfileCustomThemeAssetMap) {
  if (!assetId || !assets[assetId]) return "none";
  return `url(${JSON.stringify(assets[assetId])})`;
}

function avatarShadowValue(config: ProfileCustomThemeConfig) {
  if (config.avatar.shadow === "none") return "none";
  if (config.avatar.shadow === "glow") return `0 0 24px ${config.colors.accent}`;
  if (config.avatar.shadow === "hard") return `6px 6px 0 ${config.avatar.borderColor}`;
  return `0 10px 24px ${config.colors.border}33`;
}

export function compileProfileCustomTheme(config: ProfileCustomThemeConfig, assets: ProfileCustomThemeAssetMap = {}) {
  const sectionStyles: Partial<Record<ProfileCustomThemeSectionId, CustomThemeStyle>> = {};
  const style: CustomThemeStyle = {
    "--profile-custom-page": config.colors.page, "--profile-custom-surface": config.colors.surface, "--profile-custom-surface-alt": config.colors.surfaceAlt,
    "--profile-custom-text": config.colors.text, "--profile-custom-muted": config.colors.mutedText, "--profile-custom-accent": config.colors.accent,
    "--profile-custom-accent-alt": config.colors.accentAlt, "--profile-custom-title": config.colors.title, "--profile-custom-border": config.colors.border,
    "--profile-custom-link": config.colors.link, "--profile-custom-button-bg": config.colors.buttonBackground, "--profile-custom-button-text": config.colors.buttonText,
    "--profile-custom-badge-bg": config.colors.badgeBackground, "--profile-custom-badge-text": config.colors.badgeText, "--profile-custom-stat-bg": config.colors.statBackground,
    "--profile-custom-stat-text": config.colors.statText, "--profile-custom-separator": config.colors.separator, "--profile-custom-background-color": config.backgrounds.color,
    "--profile-custom-gradient": `linear-gradient(${config.backgrounds.gradient.angle}deg, ${config.backgrounds.gradient.from}, ${config.backgrounds.gradient.to})`,
    "--profile-custom-pattern-color": config.backgrounds.pattern.color, "--profile-custom-pattern-scale": `${config.backgrounds.pattern.scale}px`, "--profile-custom-pattern-opacity": config.backgrounds.pattern.opacity,
    "--profile-custom-pattern-rotation": `${config.backgrounds.pattern.rotation}deg`, "--profile-custom-background-image": safeAssetImage(config.backgrounds.image.assetId, assets),
    "--profile-custom-background-image-opacity": config.backgrounds.image.opacity, "--profile-custom-background-image-position": config.backgrounds.image.position,
    "--profile-custom-background-image-size": config.backgrounds.image.size, "--profile-custom-background-image-repeat": config.backgrounds.image.repeat,
    "--profile-custom-background-image-filter": `brightness(${config.backgrounds.image.brightness}) contrast(${config.backgrounds.image.contrast}) blur(${config.backgrounds.image.blur}px)`,
    "--profile-custom-overlay": config.backgrounds.overlay.color, "--profile-custom-overlay-opacity": config.backgrounds.overlay.opacity,
    "--profile-custom-heading-bg": config.headings.background, "--profile-custom-card-album-bg": config.cards.album.background,
    "--profile-custom-card-track-bg": config.cards.track.background, "--profile-custom-card-album-title-scale": config.cards.album.titleScale,
    "--profile-custom-card-track-title-scale": config.cards.track.titleScale, "--profile-custom-card-album-rotation": `${config.cards.album.rotation}deg`,
    "--profile-custom-card-track-rotation": `${config.cards.track.rotation}deg`, "--profile-custom-avatar-size": `${config.avatar.size}px`,
    "--profile-custom-avatar-bg": config.avatar.background, "--profile-custom-avatar-shadow": avatarShadowValue(config), "--profile-custom-avatar-border": `${config.avatar.borderWidth}px solid ${config.avatar.borderColor}`,
    "--profile-custom-medal-gold": config.podium.gold, "--profile-custom-medal-silver": config.podium.silver, "--profile-custom-medal-bronze": config.podium.bronze,
    "--profile-custom-video-spacing": `${config.video.spacing}px`, "--profile-custom-motion-duration": `${config.motion.duration}ms`,
    "--profile-background": config.colors.page, "--profile-surface": config.colors.surface, "--profile-text": config.colors.text,
    "--profile-muted": config.colors.mutedText, "--profile-accent": config.colors.accent, "--profile-border": config.colors.border,
    "--profile-surface-secondary": config.colors.surfaceAlt, "--profile-shadow": config.colors.border,
    "--profile-stat-color": config.colors.statBackground, "--profile-button-background": config.colors.buttonBackground,
    "--profile-button-text": config.colors.buttonText, "--profile-kouize": config.colors.surfaceAlt, "--profile-kouize-text": config.colors.text,
  };
  for (const [role, token] of Object.entries(config.typography)) {
    style[`--profile-custom-font-${role}`] = fontStacks[token.family]; style[`--profile-custom-font-${role}-size`] = `${token.size}px`;
    style[`--profile-custom-font-${role}-weight`] = token.weight; style[`--profile-custom-font-${role}-spacing`] = `${token.letterSpacing}em`;
    style[`--profile-custom-font-${role}-line`] = token.lineHeight; style[`--profile-custom-font-${role}-transform`] = token.transform;
    style[`--profile-custom-font-${role}-style`] = token.italic ? "italic" : "normal";
  }
  for (const [target, name] of Object.entries(targetNames) as Array<[CustomThemeBoxTarget, string]>) {
    const border = config.borders[target];
    style[`--profile-custom-${name}-border`] = border.style === "none" || border.width === 0 ? "none" : `${border.width}px ${border.style} ${border.color}`;
    style[`--profile-custom-${name}-radius`] = `${config.radii[target]}px`; style[`--profile-custom-${name}-shadow`] = shadowValue(config.shadows[target]);
  }
  if (config.schemaVersion === 2) {
    const boxKinds = ["surface", "card", "cover", "copy"] as const;
    const textKinds = ["heading", "titleText", "secondaryText"] as const;
    for (const sectionId of customThemeSectionIds) {
      const sectionStyle: CustomThemeStyle = {};
      const section = config.sections[sectionId];
      const prefix = `--profile-custom-section-${sectionNames[sectionId]}`;
      for (const boxKind of boxKinds) {
        const token: CustomThemeSectionBoxToken = section[boxKind];
        style[`${prefix}-${boxKind}-background`] = token.background;
        style[`${prefix}-${boxKind}-border`] = borderValue(token.border);
        style[`${prefix}-${boxKind}-radius`] = `${token.radius}px`;
        style[`${prefix}-${boxKind}-shadow`] = shadowValue(token.shadow);
        sectionStyle[`--profile-section-${boxKind}-background`] = token.background;
        sectionStyle[`--profile-section-${boxKind}-border`] = borderValue(token.border);
        sectionStyle[`--profile-section-${boxKind}-radius`] = `${token.radius}px`;
        sectionStyle[`--profile-section-${boxKind}-shadow`] = shadowValue(token.shadow);
        sectionStyle[`--profile-section-${boxKind}-padding`] = `${token.padding}px`;
        style[`${prefix}-${boxKind}-padding`] = `${token.padding}px`;
      }
      for (const textKind of textKinds) {
        const token: CustomThemeSectionTextToken = section[textKind];
        const textName = textKind === "titleText" ? "title" : textKind === "secondaryText" ? "secondary" : "heading";
        style[`${prefix}-${textName}-font`] = fontStacks[token.family];
        style[`${prefix}-${textName}-size`] = `${token.size}px`;
        style[`${prefix}-${textName}-weight`] = token.weight;
        style[`${prefix}-${textName}-color`] = token.color;
        style[`${prefix}-${textName}-transform`] = token.transform;
        style[`${prefix}-${textName}-style`] = token.italic ? "italic" : "normal";
        sectionStyle[`--profile-section-${textName}-font`] = fontStacks[token.family];
        sectionStyle[`--profile-section-${textName}-size`] = `${token.size}px`;
        sectionStyle[`--profile-section-${textName}-weight`] = token.weight;
        sectionStyle[`--profile-section-${textName}-color`] = token.color;
        sectionStyle[`--profile-section-${textName}-transform`] = token.transform;
        sectionStyle[`--profile-section-${textName}-style`] = token.italic ? "italic" : "normal";
      }
      sectionStyles[sectionId] = sectionStyle;
    }
  }
  return { style, classes: [
    `profile-custom-bg-${config.backgrounds.mode}`, `profile-custom-pattern-${config.backgrounds.pattern.kind}`,
    `profile-custom-heading-${config.headings.separator}`, `profile-custom-heading-align-${config.headings.align}`,
    `profile-custom-button-${config.buttons.preset}`, `profile-custom-button-hover-${config.buttons.hover}`, `profile-custom-button-click-${config.buttons.click}`,
    `profile-custom-avatar-${config.avatar.shape}`, `profile-custom-stats-${config.stats.variant}`, `profile-custom-podium-${config.podium.shape}`,
    `profile-custom-podium-frame-${config.podium.frame}`, `profile-custom-motion-entrance-${config.motion.entrance}`,
    `profile-custom-motion-hover-${config.motion.hover}`, `profile-custom-motion-link-${config.motion.link}`,
    `profile-custom-album-align-${config.cards.album.textAlign}`, `profile-custom-track-align-${config.cards.track.textAlign}`,
    `profile-custom-album-frame-${config.cards.album.imageFrame}`, `profile-custom-track-frame-${config.cards.track.imageFrame}`,
    `profile-custom-album-badge-${config.cards.album.badgeStyle}`, `profile-custom-track-badge-${config.cards.track.badgeStyle}`,
    `profile-custom-album-hover-${config.cards.album.hover}`, `profile-custom-track-hover-${config.cards.track.hover}`,
    `profile-custom-heading-shadow-${config.headings.shadow}`,
  ], sectionStyles };
}
