import type { ProfileCustomThemeConfig } from "@/lib/profile-custom-theme/sections";

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

export function customThemeContrastRatio(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function getCustomThemeContrastWarnings(config: ProfileCustomThemeConfig) {
  const pairs = [
    ["Texte principal", config.colors.text, config.colors.page, 4.5],
    ["Texte secondaire", config.colors.mutedText, config.colors.page, 4.5],
    ["Liens", config.colors.link, config.colors.page, 4.5],
    ["Boutons", config.colors.buttonText, config.colors.buttonBackground, 4.5],
    ["Badges", config.colors.badgeText, config.colors.badgeBackground, 4.5],
    ["Statistiques", config.colors.statText, config.colors.statBackground, 3],
  ] as const;
  return pairs.flatMap(([label, foreground, background, minimum]) => {
    const ratio = customThemeContrastRatio(foreground, background);
    return ratio < minimum ? [{ label, foreground, background, ratio, minimum }] : [];
  });
}

export function autoFixCustomThemeContrast<T extends ProfileCustomThemeConfig>(config: T): T {
  const next = structuredClone(config);
  const bestText = (background: string) =>
    customThemeContrastRatio("#111111", background) >= customThemeContrastRatio("#FFFFFF", background)
      ? "#111111"
      : "#FFFFFF";
  next.colors.text = bestText(next.colors.page);
  next.colors.mutedText = next.colors.text;
  next.colors.link = bestText(next.colors.page);
  next.colors.buttonText = bestText(next.colors.buttonBackground);
  next.colors.badgeText = bestText(next.colors.badgeBackground);
  next.colors.statText = bestText(next.colors.statBackground);
  return next;
}
