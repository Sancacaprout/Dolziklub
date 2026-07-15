"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type LiveMetrics = { album_count: number; review_count: number; rating_sum: number };

export function ClubLiveMetrics({ baseAlbums, baseReviews, baseRatingSum, baseMembers, variant = "ticker" }: { baseAlbums: number; baseReviews: number; baseRatingSum: number; baseMembers: number; variant?: "ticker" | "poster" }) {
  const configured = isSupabaseConfigured();
  const [live, setLive] = useState<LiveMetrics | null>(null);
  const [members, setMembers] = useState(baseMembers);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    void Promise.all([supabase.rpc("get_public_club_draw_metrics"), supabase.from("member_public_profiles").select("id", { count: "exact", head: true })]).then(([metrics, profiles]) => {
      if (!metrics.error && metrics.data?.[0]) setLive(metrics.data[0] as LiveMetrics);
      if (profiles.count !== null) setMembers(profiles.count);
    });
  }, [configured]);

  const liveAlbums = Number(live?.album_count ?? 0);
  const indexedAlbums = baseAlbums + liveAlbums;
  const reviews = baseReviews + Number(live?.review_count ?? 0);
  const average = reviews ? (baseRatingSum + Number(live?.rating_sum ?? 0)) / reviews : null;

  if (variant === "poster") return <div className="poster-stats"><div><b>{baseAlbums}</b><span>albums archivés</span></div><div><b>{liveAlbums || "—"}</b><span>albums en cours</span></div><div><b>{members}</b><span>membres identifiés</span></div><div><b>{reviews || "—"}</b><span>verdicts rendus</span></div><div><b>{average?.toFixed(1) ?? "—"}</b><span>moyenne du club</span></div></div>;
  return <section className="ticker"><span>{indexedAlbums} ALBUMS INDEXÉS</span><span>{reviews} VERDICTS RÉPERTORIÉS</span><span>{members} PARTICIPANTS IDENTIFIÉS</span></section>;
}
