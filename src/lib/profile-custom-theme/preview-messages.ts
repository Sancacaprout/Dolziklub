import { sanitizeProfileThemeAssetMap } from "@/lib/profile-custom-theme/assets";
import {
  customThemeSectionIds,
  type ProfileCustomThemeConfig,
  type ProfileCustomThemeSectionId,
} from "@/lib/profile-custom-theme/sections";
import {
  validateProfileCustomThemeConfig,
} from "@/lib/profile-custom-theme/validator";
import type { ProfileCustomThemeAssetMap } from "@/lib/profile-custom-theme/types";

export const CUSTOM_THEME_PREVIEW_READY = "dolziklub:custom-theme-preview-ready";
export const CUSTOM_THEME_PREVIEW_UPDATE = "dolziklub:custom-theme-preview-update";
export const CUSTOM_THEME_PREVIEW_SECTION = "dolziklub:custom-theme-preview-section";
export const CUSTOM_THEME_PREVIEW_FOCUS = "dolziklub:custom-theme-preview-focus";

export type CustomThemePreviewReadyMessage = {
  type: typeof CUSTOM_THEME_PREVIEW_READY;
  sessionId: string;
};

export type CustomThemePreviewUpdateMessage = {
  type: typeof CUSTOM_THEME_PREVIEW_UPDATE;
  sessionId: string;
  config: ProfileCustomThemeConfig;
  assets: ProfileCustomThemeAssetMap;
};

type PreviewMessageEvent = Pick<MessageEvent<unknown>, "data" | "origin" | "source">;
export type CustomThemePreviewSectionMessage = {
  type: typeof CUSTOM_THEME_PREVIEW_SECTION;
  sessionId: string;
  sectionId: ProfileCustomThemeSectionId | null;
  interaction: "hover" | "select";
};

export type CustomThemePreviewFocusMessage = {
  type: typeof CUSTOM_THEME_PREVIEW_FOCUS;
  sessionId: string;
  sectionId: ProfileCustomThemeSectionId;
  scroll: boolean;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createCustomThemePreviewReadyMessage(
  sessionId: string,
): CustomThemePreviewReadyMessage {

  return { type: CUSTOM_THEME_PREVIEW_READY, sessionId };
}

export function createCustomThemePreviewUpdateMessage(
  sessionId: string,
  config: ProfileCustomThemeConfig,
  assets: ProfileCustomThemeAssetMap = {},
): CustomThemePreviewUpdateMessage {
  return { type: CUSTOM_THEME_PREVIEW_UPDATE, sessionId, config, assets };
}

export function readTrustedCustomThemePreviewReady(
  event: PreviewMessageEvent,
  expected: { origin: string; source: MessageEventSource | null; sessionId: string },
) {
  if (event.origin !== expected.origin || event.source !== expected.source) return null;
  if (!record(event.data)) return null;
  if (
    event.data.type !== CUSTOM_THEME_PREVIEW_READY ||
    event.data.sessionId !== expected.sessionId
  ) return null;
  return event.data as CustomThemePreviewReadyMessage;
}

function sectionId(value: unknown): value is ProfileCustomThemeSectionId {
  return typeof value === "string" && customThemeSectionIds.includes(value as ProfileCustomThemeSectionId);
}

export function createCustomThemePreviewSectionMessage(
  sessionId: string,
  selectedSectionId: ProfileCustomThemeSectionId | null,
  interaction: "hover" | "select",
): CustomThemePreviewSectionMessage {
  return { type: CUSTOM_THEME_PREVIEW_SECTION, sessionId, sectionId: selectedSectionId, interaction };
}

export function createCustomThemePreviewFocusMessage(
  sessionId: string,
  selectedSectionId: ProfileCustomThemeSectionId,
  scroll = true,
): CustomThemePreviewFocusMessage {
  return { type: CUSTOM_THEME_PREVIEW_FOCUS, sessionId, sectionId: selectedSectionId, scroll };
}

export function readTrustedCustomThemePreviewSection(
  event: PreviewMessageEvent,
  expected: { origin: string; source: MessageEventSource | null; sessionId: string },
) {
  if (event.origin !== expected.origin || event.source !== expected.source) return null;
  if (!record(event.data)) return null;
  if (
    event.data.type !== CUSTOM_THEME_PREVIEW_SECTION ||
    event.data.sessionId !== expected.sessionId ||
    !["hover", "select"].includes(String(event.data.interaction)) ||
    !(event.data.sectionId === null || sectionId(event.data.sectionId))
  ) return null;
  return event.data as CustomThemePreviewSectionMessage;
}

export function readTrustedCustomThemePreviewFocus(
  event: PreviewMessageEvent,
  expected: { origin: string; source: MessageEventSource | null; sessionId: string },
) {
  if (event.origin !== expected.origin || event.source !== expected.source) return null;
  if (!record(event.data)) return null;
  if (
    event.data.type !== CUSTOM_THEME_PREVIEW_FOCUS ||
    event.data.sessionId !== expected.sessionId ||
    !sectionId(event.data.sectionId) ||
    typeof event.data.scroll !== "boolean"
  ) return null;
  return event.data as CustomThemePreviewFocusMessage;
}

export function readTrustedCustomThemePreviewUpdate(
  event: PreviewMessageEvent,
  expected: { origin: string; source: MessageEventSource | null; sessionId: string },
) {
  if (event.origin !== expected.origin || event.source !== expected.source) return null;
  if (!record(event.data)) return null;
  if (
    event.data.type !== CUSTOM_THEME_PREVIEW_UPDATE ||
    event.data.sessionId !== expected.sessionId
  ) return null;
  const validation = validateProfileCustomThemeConfig(event.data.config);
  if (!validation.ok) return null;
  const assets = sanitizeProfileThemeAssetMap(event.data.assets);
  if (!assets) return null;
  return {
    type: CUSTOM_THEME_PREVIEW_UPDATE,
    sessionId: expected.sessionId,
    config: validation.value,
    assets,
  } satisfies CustomThemePreviewUpdateMessage;
}
