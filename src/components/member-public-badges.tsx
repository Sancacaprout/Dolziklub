"use client";

import { useEffect, useState } from "react";
import { BadgeArt } from "@/components/badge-art";
import type { PublicBadge } from "@/lib/badges/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function MemberPublicBadges({ participantId }: { participantId: string }) {
  const [badges, setBadges] = useState<PublicBadge[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void (async () => {
      const result = await getSupabaseBrowserClient().rpc("get_public_equipped_badges", { p_participant_id: participantId });
      setBadges((result.data ?? []) as PublicBadge[]);
    })();
  }, [participantId]);
  if (!badges.length) return null;
  return <div className="profile-badges" data-profile-part="badges" aria-label="Badges exposés">
    {badges.map((badge) => <article className={`profile-badge badge-card--${badge.rarity}`} key={badge.badge_key} title={badge.description}>
      <BadgeArt imagePath={badge.image_path} name={badge.name} rarity={badge.rarity} size={72} /><span>{badge.name}</span>
    </article>)}
  </div>;
}
