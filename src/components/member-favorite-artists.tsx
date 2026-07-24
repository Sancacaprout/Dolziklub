"use client";

import { useEffect, useState } from "react";
import {
  FavoriteArtistsPodium,
  type FavoriteArtist,
} from "@/components/favorite-artists-podium";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export function MemberFavoriteArtists({ username }: { username: string | null }) {
  const configured = isSupabaseConfigured();
  const [artists, setArtists] = useState<FavoriteArtist[]>([]);

  useEffect(() => {
    if (!configured || !username) return;
    const supabase = getSupabaseBrowserClient();
    const load = async () => {
      const { data: profile } = await supabase
        .from("member_public_profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (!profile?.id) return;
      const { data } = await supabase
        .from("profile_favorite_artists")
        .select("id,rank,artist_name,deezer_artist_id,deezer_url,image_path,image_url")
        .eq("participant_id", profile.id)
        .order("rank");
      setArtists((data ?? []) as FavoriteArtist[]);
    };
    void load();
    const channel = supabase
      .channel("member-favorite-artists-" + username)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "profile_favorite_artists",
      }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [configured, username]);

  return <FavoriteArtistsPodium artists={artists} />;
}
