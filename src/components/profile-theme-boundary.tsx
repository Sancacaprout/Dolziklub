"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
  children,
}: {
  username: string | null;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<ProfileThemeId | null>(null);

  useEffect(() => {
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
  }, [username]);

  if (!theme) return <>{children}</>;

  return (
    <div className="profile-theme profile-theme--full-page" data-profile-theme={theme}>
      {children}
    </div>
  );
}
