"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { memeChangedEvent } from "@/components/meme-comment-count";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

let seenMemeChange: string | null = null;

export function LiveClubRefresh({ watchMemes = false }: { watchMemes?: boolean }) {
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
      .on("postgres_changes", { event: "*", schema: "public", table: "extra_listening_requests" }, refresh)
      .subscribe();
    window.addEventListener("focus", refresh);
    const onMemeChanged = (event: StorageEvent) => {
      if (event.key !== memeChangedEvent) return;
      seenMemeChange = event.newValue;
      refresh();
    };
    if (watchMemes) {
      window.addEventListener("storage", onMemeChanged);
      try {
        const latestChange = window.localStorage.getItem(memeChangedEvent);
        if (latestChange !== seenMemeChange) {
          seenMemeChange = latestChange;
          refresh();
        }
      } catch {}
    }

    return () => {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onMemeChanged);
      void supabase.removeChannel(channel);
    };
  }, [router, watchMemes]);

  return null;
}
