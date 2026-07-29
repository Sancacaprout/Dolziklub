import { isProfileThemeId } from "@/lib/profile-themes";
import {
  CUSTOM_THEME_MAX_BYTES,
  CUSTOM_THEME_MAX_DECORATIONS,
  customThemeBoxTargets,
  customThemeDecorationSlots,
  customThemeFontFamilies,
  customThemePatternKinds,
  customThemeTypographyRoles,
  type ProfileCustomThemeConfigV1,
  type ProfileCustomThemeValidation,
} from "@/lib/profile-custom-theme/types";

const HEX_COLOR = /^#[0-9A-F]{6}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const topLevelKeys = [
  "schemaVersion", "inspirationSourceThemeId", "colors", "typography", "backgrounds",
  "borders", "radii", "shadows", "cards", "headings", "buttons", "avatar",
  "stats", "podium", "video", "decorations", "motion",
] as const;

const colorKeys = [
  "page", "surface", "surfaceAlt", "text", "mutedText", "accent", "accentAlt",
  "title", "border", "link", "buttonBackground", "buttonText", "badgeBackground",
  "badgeText", "statBackground", "statText", "separator",
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function enumeration<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function numberIn(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function integerIn(value: unknown, minimum: number, maximum: number) {
  return numberIn(value, minimum, maximum) && Number.isInteger(value);
}

function addError(errors: string[], condition: boolean, path: string) {
  if (!condition) errors.push(path);
}

function validateTypography(value: unknown, errors: string[]) {
  if (!record(value) || !exactKeys(value, customThemeTypographyRoles)) {
    errors.push("typography");
    return;
  }
  const sizeRanges = {
    display: [24, 96], body: [13, 24], label: [10, 18], button: [10, 20], stat: [24, 72],
  } as const;
  for (const role of customThemeTypographyRoles) {
    const token = value[role];
    if (!record(token) || !exactKeys(token, ["family", "size", "weight", "letterSpacing", "lineHeight", "transform", "italic"])) {
      errors.push(`typography.${role}`);
      continue;
    }
    addError(errors, enumeration(token.family, customThemeFontFamilies), `typography.${role}.family`);
    const [minimumSize, maximumSize] = sizeRanges[role];
    addError(errors, numberIn(token.size, minimumSize, maximumSize), `typography.${role}.size`);
    addError(errors, [400, 500, 600, 700, 800].includes(Number(token.weight)), `typography.${role}.weight`);
    addError(errors, numberIn(token.letterSpacing, -0.05, 0.2), `typography.${role}.letterSpacing`);
    addError(errors, numberIn(token.lineHeight, 0.9, 1.9), `typography.${role}.lineHeight`);
    addError(errors, enumeration(token.transform, ["none", "uppercase", "lowercase"]), `typography.${role}.transform`);
    addError(errors, typeof token.italic === "boolean", `typography.${role}.italic`);
  }
}

function validateBackground(value: unknown, errors: string[]) {
  if (!record(value) || !exactKeys(value, ["mode", "color", "gradient", "pattern", "image", "overlay"])) {
    errors.push("backgrounds");
    return;
  }
  addError(errors, enumeration(value.mode, ["solid", "gradient", "pattern", "image"]), "backgrounds.mode");
  addError(errors, typeof value.color === "string" && HEX_COLOR.test(value.color), "backgrounds.color");

  const gradient = value.gradient;
  if (!record(gradient) || !exactKeys(gradient, ["from", "to", "angle"])) errors.push("backgrounds.gradient");
  else {
    addError(errors, typeof gradient.from === "string" && HEX_COLOR.test(gradient.from), "backgrounds.gradient.from");
    addError(errors, typeof gradient.to === "string" && HEX_COLOR.test(gradient.to), "backgrounds.gradient.to");
    addError(errors, integerIn(gradient.angle, 0, 360), "backgrounds.gradient.angle");
  }

  const pattern = value.pattern;
  if (!record(pattern) || !exactKeys(pattern, ["kind", "color", "scale", "opacity", "rotation"])) errors.push("backgrounds.pattern");
  else {
    addError(errors, enumeration(pattern.kind, customThemePatternKinds), "backgrounds.pattern.kind");
    addError(errors, typeof pattern.color === "string" && HEX_COLOR.test(pattern.color), "backgrounds.pattern.color");
    addError(errors, integerIn(pattern.scale, 8, 120), "backgrounds.pattern.scale");
    addError(errors, numberIn(pattern.opacity, 0, 0.5), "backgrounds.pattern.opacity");
    addError(errors, integerIn(pattern.rotation, -45, 45), "backgrounds.pattern.rotation");
  }

  const image = value.image;
  if (!record(image) || !exactKeys(image, ["assetId", "opacity", "position", "size", "repeat", "brightness", "contrast", "blur"])) errors.push("backgrounds.image");
  else {
    addError(errors, image.assetId === null || (typeof image.assetId === "string" && UUID.test(image.assetId)), "backgrounds.image.assetId");
    addError(errors, numberIn(image.opacity, 0.1, 1), "backgrounds.image.opacity");
    addError(errors, enumeration(image.position, ["center", "top", "bottom", "left", "right"]), "backgrounds.image.position");
    addError(errors, enumeration(image.size, ["cover", "contain"]), "backgrounds.image.size");
    addError(errors, enumeration(image.repeat, ["no-repeat", "repeat"]), "backgrounds.image.repeat");
    addError(errors, numberIn(image.brightness, 0.5, 1.5), "backgrounds.image.brightness");
    addError(errors, numberIn(image.contrast, 0.5, 1.5), "backgrounds.image.contrast");
    addError(errors, numberIn(image.blur, 0, 12), "backgrounds.image.blur");
  }

  const overlay = value.overlay;
  if (!record(overlay) || !exactKeys(overlay, ["color", "opacity"])) errors.push("backgrounds.overlay");
  else {
    addError(errors, typeof overlay.color === "string" && HEX_COLOR.test(overlay.color), "backgrounds.overlay.color");
    addError(errors, numberIn(overlay.opacity, 0, 0.85), "backgrounds.overlay.opacity");
  }
}

function validateTargetRecords(value: Record<string, unknown>, errors: string[]) {
  const borders = value.borders;
  if (!record(borders) || !exactKeys(borders, customThemeBoxTargets)) errors.push("borders");
  else for (const target of customThemeBoxTargets) {
    const token = borders[target];
    if (!record(token) || !exactKeys(token, ["width", "style", "color"])) errors.push(`borders.${target}`);
    else {
      addError(errors, integerIn(token.width, 0, 6), `borders.${target}.width`);
      addError(errors, enumeration(token.style, ["none", "solid", "double", "dashed"]), `borders.${target}.style`);
      addError(errors, typeof token.color === "string" && HEX_COLOR.test(token.color), `borders.${target}.color`);
    }
  }

  const radii = value.radii;
  if (!record(radii) || !exactKeys(radii, customThemeBoxTargets)) errors.push("radii");
  else for (const target of customThemeBoxTargets) addError(errors, integerIn(radii[target], 0, 48), `radii.${target}`);

  const shadows = value.shadows;
  if (!record(shadows) || !exactKeys(shadows, customThemeBoxTargets)) errors.push("shadows");
  else for (const target of customThemeBoxTargets) {
    const token = shadows[target];
    if (!record(token) || !exactKeys(token, ["kind", "x", "y", "blur", "spread", "color"])) errors.push(`shadows.${target}`);
    else {
      addError(errors, enumeration(token.kind, ["none", "soft", "hard", "glow"]), `shadows.${target}.kind`);
      addError(errors, integerIn(token.x, -16, 16), `shadows.${target}.x`);
      addError(errors, integerIn(token.y, -16, 16), `shadows.${target}.y`);
      addError(errors, integerIn(token.blur, 0, 40), `shadows.${target}.blur`);
      addError(errors, integerIn(token.spread, -4, 12), `shadows.${target}.spread`);
      addError(errors, typeof token.color === "string" && HEX_COLOR.test(token.color), `shadows.${target}.color`);
    }
  }
}

function validateCard(value: unknown, path: string, errors: string[]) {
  if (!record(value) || !exactKeys(value, ["background", "textAlign", "titleScale", "imageFrame", "badgeStyle", "hover", "rotation"])) {
    errors.push(path);
    return;
  }
  addError(errors, typeof value.background === "string" && HEX_COLOR.test(value.background), `${path}.background`);
  addError(errors, enumeration(value.textAlign, ["left", "center"]), `${path}.textAlign`);
  addError(errors, numberIn(value.titleScale, 0.75, 1.5), `${path}.titleScale`);
  addError(errors, enumeration(value.imageFrame, ["none", "line", "double"]), `${path}.imageFrame`);
  addError(errors, enumeration(value.badgeStyle, ["square", "soft", "pill"]), `${path}.badgeStyle`);
  addError(errors, enumeration(value.hover, ["none", "lift", "zoom", "glow"]), `${path}.hover`);
  addError(errors, numberIn(value.rotation, -3, 3), `${path}.rotation`);
}

function validateComponentTokens(value: Record<string, unknown>, errors: string[]) {
  const cards = value.cards;
  if (!record(cards) || !exactKeys(cards, ["album", "track"])) errors.push("cards");
  else {
    validateCard(cards.album, "cards.album", errors);
    validateCard(cards.track, "cards.track", errors);
  }

  const headings = value.headings;
  if (!record(headings) || !exactKeys(headings, ["align", "separator", "background", "shadow"])) errors.push("headings");
  else {
    addError(errors, enumeration(headings.align, ["left", "center"]), "headings.align");
    addError(errors, enumeration(headings.separator, ["line", "double", "block", "boxed", "none"]), "headings.separator");
    addError(errors, typeof headings.background === "string" && HEX_COLOR.test(headings.background), "headings.background");
    addError(errors, enumeration(headings.shadow, ["none", "soft", "hard"]), "headings.shadow");
  }

  const buttons = value.buttons;
  if (!record(buttons) || !exactKeys(buttons, ["preset", "hover", "click"])) errors.push("buttons");
  else {
    addError(errors, enumeration(buttons.preset, ["brutalist", "minimal", "neon", "pill", "ticket", "arcade", "metal", "paper"]), "buttons.preset");
    addError(errors, enumeration(buttons.hover, ["none", "lift", "glow", "invert"]), "buttons.hover");
    addError(errors, enumeration(buttons.click, ["none", "press", "pulse"]), "buttons.click");
  }

  const avatar = value.avatar;
  if (!record(avatar) || !exactKeys(avatar, ["shape", "size", "background", "borderWidth", "borderColor", "shadow"])) errors.push("avatar");
  else {
    addError(errors, enumeration(avatar.shape, ["circle", "square", "rounded", "hexagon"]), "avatar.shape");
    addError(errors, integerIn(avatar.size, 72, 220), "avatar.size");
    addError(errors, typeof avatar.background === "string" && HEX_COLOR.test(avatar.background), "avatar.background");
    addError(errors, integerIn(avatar.borderWidth, 0, 8), "avatar.borderWidth");
    addError(errors, typeof avatar.borderColor === "string" && HEX_COLOR.test(avatar.borderColor), "avatar.borderColor");
    addError(errors, enumeration(avatar.shadow, ["none", "soft", "hard", "glow"]), "avatar.shadow");
  }

  const stats = value.stats;
  if (!record(stats) || !exactKeys(stats, ["variant"])) errors.push("stats");
  else addError(errors, enumeration(stats.variant, ["grid", "cards", "hud", "bars", "tickets", "capsules", "giant"]), "stats.variant");

  const podium = value.podium;
  if (!record(podium) || !exactKeys(podium, ["shape", "frame", "gold", "silver", "bronze"])) errors.push("podium");
  else {
    addError(errors, enumeration(podium.shape, ["circle", "square", "rounded", "hexagon"]), "podium.shape");
    addError(errors, enumeration(podium.frame, ["none", "line", "double", "medallion"]), "podium.frame");
    for (const key of ["gold", "silver", "bronze"] as const) addError(errors, typeof podium[key] === "string" && HEX_COLOR.test(podium[key]), `podium.${key}`);
  }

  const video = value.video;
  if (!record(video) || !exactKeys(video, ["spacing"])) errors.push("video");
  else addError(errors, integerIn(video.spacing, 0, 48), "video.spacing");
}

function validateDecorations(value: unknown, errors: string[]) {
  if (!Array.isArray(value) || value.length > CUSTOM_THEME_MAX_DECORATIONS) {
    errors.push("decorations");
    return;
  }
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `decorations.${index}`;
    if (!record(item) || !exactKeys(item, ["id", "assetId", "slot", "size", "opacity", "rotation", "mirror", "visibility", "alt"])) {
      errors.push(path);
      return;
    }
    addError(errors, typeof item.id === "string" && UUID.test(item.id) && !ids.has(item.id), `${path}.id`);
    if (typeof item.id === "string") ids.add(item.id);
    addError(errors, typeof item.assetId === "string" && UUID.test(item.assetId), `${path}.assetId`);
    addError(errors, enumeration(item.slot, customThemeDecorationSlots), `${path}.slot`);
    addError(errors, integerIn(item.size, 24, 320), `${path}.size`);
    addError(errors, numberIn(item.opacity, 0.1, 1), `${path}.opacity`);
    addError(errors, integerIn(item.rotation, -15, 15), `${path}.rotation`);
    addError(errors, typeof item.mirror === "boolean", `${path}.mirror`);
    addError(errors, enumeration(item.visibility, ["all", "desktop", "mobile"]), `${path}.visibility`);
    addError(errors, typeof item.alt === "string" && item.alt.length <= 120, `${path}.alt`);
  });
}

function validateMotion(value: unknown, errors: string[]) {
  if (!record(value) || !exactKeys(value, ["entrance", "hover", "link", "counter", "duration"])) {
    errors.push("motion");
    return;
  }
  addError(errors, enumeration(value.entrance, ["none", "fade", "slide"]), "motion.entrance");
  addError(errors, enumeration(value.hover, ["none", "lift", "zoom", "glow"]), "motion.hover");
  addError(errors, enumeration(value.link, ["none", "underline"]), "motion.link");
  addError(errors, enumeration(value.counter, ["none", "count"]), "motion.counter");
  addError(errors, integerIn(value.duration, 100, 400), "motion.duration");
}

export function profileCustomThemeByteLength(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function validateProfileCustomThemeConfig(value: unknown): ProfileCustomThemeValidation {
  const errors: string[] = [];
  if (!record(value) || !exactKeys(value, topLevelKeys)) return { ok: false, value: null, errors: ["config"] };
  addError(errors, value.schemaVersion === 1, "schemaVersion");
  addError(
    errors,
    value.inspirationSourceThemeId === null ||
      (isProfileThemeId(value.inspirationSourceThemeId) && value.inspirationSourceThemeId !== "custom"),
    "inspirationSourceThemeId",
  );
  if (!record(value.colors) || !exactKeys(value.colors, colorKeys)) errors.push("colors");
  else for (const key of colorKeys) addError(errors, typeof value.colors[key] === "string" && HEX_COLOR.test(value.colors[key]), `colors.${key}`);
  validateTypography(value.typography, errors);
  validateBackground(value.backgrounds, errors);
  validateTargetRecords(value, errors);
  validateComponentTokens(value, errors);
  validateDecorations(value.decorations, errors);
  validateMotion(value.motion, errors);
  addError(errors, profileCustomThemeByteLength(value) <= CUSTOM_THEME_MAX_BYTES, "config.size");
  if (errors.length) return { ok: false, value: null, errors: [...new Set(errors)] };
  return { ok: true, value: value as ProfileCustomThemeConfigV1, errors: [] };
}

export function safeProfileCustomThemeConfig(value: unknown, fallback: ProfileCustomThemeConfigV1) {
  const validation = validateProfileCustomThemeConfig(value);
  return validation.ok ? validation.value : fallback;
}
