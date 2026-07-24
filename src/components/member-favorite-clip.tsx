"use client";

import { useEffect, useState } from "react";
import { YouTubeClipEmbed } from "@/components/youtube-clip-embed";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { isYouTubeVideoId } from "@/lib/youtube-video";

export function MemberFavoriteClip({ username }: { username: string | null }) {
  const configured = isSupabaseConfigured();
  const [videoId, setVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || !username) return;
    const supabase = getSupabaseBrowserClient();
    const load = async () => {
      const { data } = await supabase
        .from("member_public_profiles")
        .select("favorite_clip_youtube_id")
        .eq("username", username)
        .maybeSingle();
      setVideoId(isYouTubeVideoId(data?.favorite_clip_youtube_id) ? data.favorite_clip_youtube_id : null);
    };
    void load();
    const channel = supabase
      .channel("member-favorite-clip-" + username)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "member_public_profiles",
        filter: "username=eq." + username,
      }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [configured, username]);

  if (!videoId) return null;
  return (
    <section className="profile-favorites profile-favorite-clip" aria-labelledby="favorite-clip-heading">
      <div className="member-archive__heading">
        <div>
          <p className="eyebrow">VIDÉO FÉTICHE</p>
          <h2 id="favorite-clip-heading">Mon clip préféré</h2>
        </div>
      </div>
      <YouTubeClipEmbed videoId={videoId} title="Clip préféré du membre" />
    </section>
  );
}
