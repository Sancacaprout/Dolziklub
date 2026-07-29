import { sanitizeProfileThemeAssetMap } from "@/lib/profile-custom-theme/assets";
import {
  validateProfileCustomThemeConfig,
} from "@/lib/profile-custom-theme/validator";
import type { ProfileCustomThemeAssetMap, ProfileCustomThemeConfigV1 } from "@/lib/profile-custom-theme/types";

export const CUSTOM_THEME_PREVIEW_READY = "dolziklub:custom-theme-preview-ready";
export const CUSTOM_THEME_PREVIEW_UPDATE = "dolziklub:custom-theme-preview-update";

export type CustomThemePreviewReadyMessage = {
  type: typeof CUSTOM_THEME_PREVIEW_READY;
  sessionId: string;
};

export type CustomThemePreviewUpdateMessage = {
  type: typeof CUSTOM_THEME_PREVIEW_UPDATE;
  sessionId: string;
  config: ProfileCustomThemeConfigV1;
  assets: ProfileCustomThemeAssetMap;
};

type PreviewMessageEvent = Pick<MessageEvent<unknown>, "data" | "origin" | "source">;

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
  config: ProfileCustomThemeConfigV1,
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
