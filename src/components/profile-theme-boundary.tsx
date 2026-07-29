"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { WheelyThemeArt } from "@/components/wheely-theme-art";
import {
  cloneProfileCustomTheme,
  compileProfileCustomTheme,
  createCustomThemePreviewReadyMessage,
  readTrustedCustomThemePreviewUpdate,
  type ProfileCustomThemeConfigV1,
} from "@/lib/profile-custom-theme";
import {
  defaultProfileTheme,
  isProfileThemeId,
  type ProfileThemeId,
} from "@/lib/profile-themes";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export function ProfileThemeBoundary({
  username,
  forcedTheme,
  previewMode = false,
  lockedPreview = false,
  previewSession = null,
  children,
}: {
  username: string | null;
  forcedTheme?: ProfileThemeId | null;
  previewMode?: boolean;
  lockedPreview?: boolean;
  previewSession?: string | null;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<ProfileThemeId | null>(
    forcedTheme && forcedTheme !== defaultProfileTheme ? forcedTheme : null,
  );
  const [customConfig, setCustomConfig] = useState<ProfileCustomThemeConfigV1>(() =>
    cloneProfileCustomTheme(),
  );

  useEffect(() => {
    document.body.classList.toggle("profile-preview-embed", previewMode);
    return () => document.body.classList.remove("profile-preview-embed");
  }, [previewMode]);

  useEffect(() => {
    if (forcedTheme) return;
    if (!username || !isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();
    const refreshTheme = async () => {
      const { data } = await supabase
        .from("member_public_profiles")
        .select("profile_theme,profile_theme_selected_at")
        .eq("username", username)
        .maybeSingle();

      if (
        data?.profile_theme_selected_at &&
        isProfileThemeId(data.profile_theme) &&
        data.profile_theme !== defaultProfileTheme
      ) {
        setTheme(data.profile_theme);
      } else {
        setTheme(null);
      }
    };

    void refreshTheme();
    const channel = supabase
      .channel(`member-profile-theme-${username}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "member_public_profiles",
          filter: `username=eq.${username}`,
        },
        () => void refreshTheme(),
      )
      .subscribe();

    window.addEventListener("focus", refreshTheme);
    return () => {
      window.removeEventListener("focus", refreshTheme);
      void supabase.removeChannel(channel);
    };
  }, [forcedTheme, username]);

  useEffect(() => {
    if (!previewMode || forcedTheme !== "custom" || !previewSession) return;
    const expectedParent = window.parent;
    const receiveConfig = (event: MessageEvent<unknown>) => {
      const update = readTrustedCustomThemePreviewUpdate(event, {
        origin: window.location.origin,
        source: expectedParent,
        sessionId: previewSession,
      });
      if (update) setCustomConfig(update.config);
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
    : theme;
  const customTheme =
    effectiveTheme === "custom" ? compileProfileCustomTheme(customConfig) : null;

  if (!effectiveTheme) return <>{children}</>;

  return (
    <div
      className={`profile-theme profile-theme--full-page${customTheme ? ` ${customTheme.classes.join(" ")}` : ""}`}
      data-profile-theme={effectiveTheme}
      style={customTheme?.style}
    >
      {effectiveTheme === "wheely" ? <WheelyThemeArt variant="profile" /> : null}
      {effectiveTheme === "wheely" && previewMode && lockedPreview ? (
        <p className="profile-theme-locked-preview" role="status">APERÇU — THÈME VERROUILLÉ</p>
      ) : null}
      {children}
    </div>
  );
}
