import type { CSSProperties } from "react";
import type { CustomThemeBoxTarget, CustomThemeShadowToken, ProfileCustomThemeAssetMap, ProfileCustomThemeConfigV1 } from "@/lib/profile-custom-theme/types";

type CustomThemeStyle = CSSProperties & Record<`--${string}`, string | number>;
const fontStacks = { "space-grotesk": "var(--font-display), Arial, sans-serif", "dm-mono": "var(--font-mono), Consolas, monospace", "system-sans": "Arial, Helvetica, sans-serif", "system-serif": "Georgia, 'Times New Roman', serif" } as const;
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

export function compileProfileCustomTheme(config: ProfileCustomThemeConfigV1, assets: ProfileCustomThemeAssetMap = {}) {
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
    "--profile-custom-avatar-bg": config.avatar.background, "--profile-custom-avatar-border": `${config.avatar.borderWidth}px solid ${config.avatar.borderColor}`,
    "--profile-custom-medal-gold": config.podium.gold, "--profile-custom-medal-silver": config.podium.silver, "--profile-custom-medal-bronze": config.podium.bronze,
    "--profile-custom-video-spacing": `${config.video.spacing}px`, "--profile-custom-motion-duration": `${config.motion.duration}ms`,
    "--profile-background": config.colors.page, "--profile-surface": config.colors.surface, "--profile-text": config.colors.text,
    "--profile-muted": config.colors.mutedText, "--profile-accent": config.colors.accent, "--profile-border": config.colors.border,
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
  return { style, classes: [
    `profile-custom-bg-${config.backgrounds.mode}`, `profile-custom-pattern-${config.backgrounds.pattern.kind}`,
    `profile-custom-heading-${config.headings.separator}`, `profile-custom-heading-align-${config.headings.align}`,
    `profile-custom-button-${config.buttons.preset}`, `profile-custom-button-hover-${config.buttons.hover}`, `profile-custom-button-click-${config.buttons.click}`,
    `profile-custom-avatar-${config.avatar.shape}`, `profile-custom-stats-${config.stats.variant}`, `profile-custom-podium-${config.podium.shape}`,
    `profile-custom-podium-frame-${config.podium.frame}`, `profile-custom-motion-entrance-${config.motion.entrance}`,
    `profile-custom-motion-hover-${config.motion.hover}`, `profile-custom-motion-link-${config.motion.link}`,
  ] };
}
