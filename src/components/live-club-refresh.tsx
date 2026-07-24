"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function LiveClubRefresh() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { if (document.visibilityState === "visible") router.refresh(); }, 500);
    };
    const channel = supabase
      .channel("public-club-statistics")
      .on("postgres_changes", { event: "*", schema: "public", table: "club_draw_entries" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "member_album_reviews" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "archived_album_reviews" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "album_cover_overrides" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "member_public_profiles" }, refresh)
      .subscribe();
    window.addEventListener("focus", refresh);

    return () => {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      window.removeEventListener("focus", refresh);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
