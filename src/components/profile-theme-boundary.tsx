"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ProfileCustomThemeDecorations } from "@/components/profile-custom-theme-decorations";
import { WheelyThemeArt } from "@/components/wheely-theme-art";
import {
  cloneProfileCustomTheme,
  compileProfileCustomTheme,
  createCustomThemePreviewReadyMessage,
  readTrustedCustomThemePreviewUpdate,
  type ProfileCustomThemeAssetMap,
  type ProfileCustomThemeConfigV1,
} from "@/lib/profile-custom-theme";
import {
  defaultProfileTheme,
  type ProfileThemeId,
} from "@/lib/profile-themes";

export function ProfileThemeBoundary({
  initialTheme = null,
  initialCustomConfig = null,
  initialCustomAssets = {},
  forcedTheme,
  previewMode = false,
  lockedPreview = false,
  previewSession = null,
  children,
}: {
  initialTheme?: ProfileThemeId | null;
  initialCustomConfig?: ProfileCustomThemeConfigV1 | null;
  initialCustomAssets?: ProfileCustomThemeAssetMap;
  forcedTheme?: ProfileThemeId | null;
  previewMode?: boolean;
  lockedPreview?: boolean;
  previewSession?: string | null;
  children: ReactNode;
}) {
  const [customConfig, setCustomConfig] = useState<ProfileCustomThemeConfigV1>(() =>
    cloneProfileCustomTheme(initialCustomConfig ?? undefined),
  );
  const [customAssets, setCustomAssets] = useState<ProfileCustomThemeAssetMap>(
    initialCustomAssets,
  );

  useEffect(() => {
    document.body.classList.toggle("profile-preview-embed", previewMode);
    return () => document.body.classList.remove("profile-preview-embed");
  }, [previewMode]);

  useEffect(() => {
    if (!previewMode || forcedTheme !== "custom" || !previewSession) return;
    const expectedParent = window.parent;
    const receiveConfig = (event: MessageEvent<unknown>) => {
      const update = readTrustedCustomThemePreviewUpdate(event, {
        origin: window.location.origin,
        source: expectedParent,
        sessionId: previewSession,
      });
      if (update) {
        setCustomConfig(update.config);
        setCustomAssets(update.assets);
      }
    };
    window.addEventListener("message", receiveConfig);
    expectedParent.postMessage(
      createCustomThemePreviewReadyMessage(previewSession),
      window.location.origin,
    );
    return () => window.removeEventListener("message", receiveConfig);
  }, [forcedTheme, previewMode, previewSession]);

  const effectiveTheme = forcedTheme
    ? forcedTheme === defaultProfileTheme
      ? null
      : forcedTheme
    : initialTheme === defaultProfileTheme
      ? null
      : initialTheme;
  const customTheme =
    effectiveTheme === "custom"
      ? compileProfileCustomTheme(customConfig, customAssets)
      : null;

  if (!effectiveTheme) return <>{children}</>;

  return (
    <div
      className={[
        "profile-theme",
        "profile-theme--full-page",
        ...(customTheme?.classes ?? []),
      ].join(" ")}
      data-profile-theme={effectiveTheme}
      style={customTheme?.style}
    >
      {effectiveTheme === "wheely" ? <WheelyThemeArt variant="profile" /> : null}
      {effectiveTheme === "wheely" && previewMode && lockedPreview ? (
        <p className="profile-theme-locked-preview" role="status">APERÇU — THÈME VERROUILLÉ</p>
      ) : null}
      {effectiveTheme === "custom" ? (
        <ProfileCustomThemeDecorations config={customConfig} assets={customAssets} />
      ) : null}
      {children}
    </div>
  );
}