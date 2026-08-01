"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ProfileCustomThemeDecorations } from "@/components/profile-custom-theme-decorations";
import { WheelyThemeArt } from "@/components/wheely-theme-art";
import {
  cloneProfileCustomTheme,
  compileProfileCustomTheme,
  createCustomThemePreviewSectionMessage,
  createCustomThemePreviewReadyMessage,
  customThemeSectionIds,
  normalizeProfileCustomThemeV2,
  readTrustedCustomThemePreviewFocus,
  readTrustedCustomThemePreviewUpdate,
  type ProfileCustomThemeAssetMap,
  type ProfileCustomThemeConfig,
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
  initialCustomConfig?: ProfileCustomThemeConfig | null;
  initialCustomAssets?: ProfileCustomThemeAssetMap;
  forcedTheme?: ProfileThemeId | null;
  previewMode?: boolean;
  lockedPreview?: boolean;
  previewSession?: string | null;
  children: ReactNode;
}) {
  const [customConfig, setCustomConfig] = useState(() =>
    normalizeProfileCustomThemeV2(
      initialCustomConfig ?? cloneProfileCustomTheme(),
    ),
  );
  const rootRef = useRef<HTMLDivElement>(null);
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
    const findSection = (target: EventTarget | null) => {
      const element = target instanceof Element
        ? target.closest<HTMLElement>("[data-profile-section]")
        : null;
      const value = element?.dataset.profileSection;
      return value && customThemeSectionIds.includes(value as (typeof customThemeSectionIds)[number])
        ? { element, sectionId: value as (typeof customThemeSectionIds)[number] }
        : null;
    };
    let hoveredSection: string | null = null;
    const receiveConfig = (event: MessageEvent<unknown>) => {
      const update = readTrustedCustomThemePreviewUpdate(event, {
        origin: window.location.origin,
        source: expectedParent,
        sessionId: previewSession,
      });
      if (update) {
        setCustomConfig(normalizeProfileCustomThemeV2(update.config));
        setCustomAssets(update.assets);
        return;
      }
      const focus = readTrustedCustomThemePreviewFocus(event, {
        origin: window.location.origin,
        source: expectedParent,
        sessionId: previewSession,
      });
      if (!focus) return;
      document.querySelectorAll<HTMLElement>("[data-profile-section]").forEach((element) => {
        element.dataset.editorSelected = String(element.dataset.profileSection === focus.sectionId);
      });
      const target = document.querySelector<HTMLElement>(`[data-profile-section="${focus.sectionId}"]`);
      if (focus.scroll) target?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    };
    const sendSection = (
      sectionId: (typeof customThemeSectionIds)[number] | null,
      interaction: "hover" | "select",
    ) => expectedParent.postMessage(
      createCustomThemePreviewSectionMessage(previewSession, sectionId, interaction),
      window.location.origin,
    );
    const onPointerOver = (event: PointerEvent) => {
      const section = findSection(event.target);
      if ((section?.sectionId ?? null) === hoveredSection) return;
      hoveredSection = section?.sectionId ?? null;
      document.querySelectorAll<HTMLElement>("[data-profile-section]").forEach((element) => {
        element.dataset.editorHovered = String(element.dataset.profileSection === hoveredSection);
      });
      sendSection(section?.sectionId ?? null, "hover");
    };
    const onPointerLeave = () => {
      hoveredSection = null;
      document.querySelectorAll<HTMLElement>("[data-profile-section]").forEach((element) => {
        element.dataset.editorHovered = "false";
      });
      sendSection(null, "hover");
    };
    const onClick = (event: MouseEvent) => {
      const section = findSection(event.target);
      if (!section) return;
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll<HTMLElement>("[data-profile-section]").forEach((element) => {
        element.dataset.editorSelected = String(element === section.element);
      });
      sendSection(section.sectionId, "select");
    };
    window.addEventListener("message", receiveConfig);
    document.addEventListener("pointerover", onPointerOver);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("click", onClick, true);
    expectedParent.postMessage(
      createCustomThemePreviewReadyMessage(previewSession),
      window.location.origin,
    );
    return () => {
      window.removeEventListener("message", receiveConfig);
      document.removeEventListener("pointerover", onPointerOver);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("click", onClick, true);
    };
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !customTheme) return;
    for (const [sectionId, values] of Object.entries(customTheme.sectionStyles)) {
      const section = root.querySelector<HTMLElement>(`[data-profile-section="${sectionId}"]`);
      if (!section || !values) continue;
      for (const [name, value] of Object.entries(values)) {
        if (!name.startsWith("--profile-section-")) continue;
        section.style.setProperty(name, String(value));
      }
    }
  }, [customTheme]);

  if (!effectiveTheme) return <>{children}</>;

  return (
    <div
      ref={rootRef}
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