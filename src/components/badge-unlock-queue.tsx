"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeArt } from "@/components/badge-art";
import type { BadgeCollectionPayload, MemberBadge } from "@/lib/badges/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const sessionKey = "dol-badges-seen";

export function BadgeUnlockQueue() {
  const [queue, setQueue] = useState<MemberBadge[]>([]);
  const [claiming, setClaiming] = useState(false);
  const seen = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const stored = new Set<string>(JSON.parse(sessionStorage.getItem(sessionKey) ?? "[]") as string[]);
    seen.current = stored;
    const { data, error } = await supabase.rpc("get_my_badge_collection");
    if (error || !data) return;
    const unlocked = (data as BadgeCollectionPayload).badges.filter(
      (badge) => badge.state === "unlocked_unclaimed" && !stored.has(badge.key),
    );
    if (unlocked.length) {
      setQueue((current) => [
        ...current,
        ...unlocked.filter((badge) => !current.some((item) => item.key === badge.key)),
      ]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 350);
    const poller = window.setInterval(() => void refresh(), 15_000);
    const onRefresh = () => void refresh();
    window.addEventListener("dol-badges-refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poller);
      window.removeEventListener("dol-badges-refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [refresh]);

  const current = queue[0];
  const remember = (badge: MemberBadge) => {
    seen.current.add(badge.key);
    sessionStorage.setItem(sessionKey, JSON.stringify([...seen.current]));
    setQueue((items) => items.slice(1));
  };

  const claim = async () => {
    if (!current) return;
    setClaiming(true);
    const { error } = await getSupabaseBrowserClient().rpc("claim_my_badge", { p_badge_key: current.key });
    setClaiming(false);
    if (!error) {
      remember(current);
      window.dispatchEvent(new Event("dol-badges-refresh"));
    }
  };

  if (!current) return null;
  return (
    <div className="badge-reveal" role="dialog" aria-modal="true" aria-labelledby="badge-reveal-title">
      <div className="badge-reveal__particles" aria-hidden="true" />
      <article className={`badge-reveal__card badge-card--${current.rarity}`}>
        <p className="eyebrow">NOUVEAU BADGE</p>
        <BadgeArt imagePath={current.imagePath} name={current.name} rarity={current.rarity} size={240} />
        <h2 id="badge-reveal-title">{current.name}</h2>
        <p>{current.description}</p>
        <div>
          <button className="button" type="button" onClick={() => void claim()} disabled={claiming}>
            {claiming ? "Réclamation…" : "Réclamer le badge"}
          </button>
          <button type="button" onClick={() => remember(current)}>Plus tard</button>
        </div>
        {queue.length > 1 ? <small>{queue.length - 1} autre{queue.length > 2 ? "s" : ""} badge{queue.length > 2 ? "s" : ""} en attente</small> : null}
      </article>
    </div>
  );
}
