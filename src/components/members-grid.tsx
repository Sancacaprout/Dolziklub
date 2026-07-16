"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Member } from "@/types/member";

type PublicProfile = { username: string; avatar_path: string | null; updated_at: string | null };
type MemberGridItem = { member: Member; proposed: number; listened: number };

function avatarUrl(profile: PublicProfile | undefined) {
  if (!profile?.avatar_path) return null;
  const url = getSupabaseBrowserClient().storage.from("member-avatars").getPublicUrl(profile.avatar_path).data.publicUrl;
  return `${url}?v=${encodeURIComponent(profile.updated_at ?? profile.avatar_path)}`;
}

export function MembersGrid({ items }: { items: MemberGridItem[] }) {
  const configured = isSupabaseConfigured();
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const usernames = useMemo(
    () => items.flatMap(({ member }) => member.username ? [member.username] : []),
    [items],
  );

  const refreshProfiles = useCallback(async () => {
    if (!configured || !usernames.length) return;
    const { data } = await getSupabaseBrowserClient()
      .from("member_public_profiles")
      .select("username, avatar_path, updated_at")
      .in("username", usernames);
    if (!data) return;
    setProfiles(Object.fromEntries((data as PublicProfile[]).map((profile) => [profile.username, profile])));
  }, [configured, usernames]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshProfiles(), 0);
    if (!configured) return () => window.clearTimeout(timer);
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("member-avatar-cards")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "member_public_profiles" }, () => void refreshProfiles())
      .subscribe();
    window.addEventListener("focus", refreshProfiles);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshProfiles);
      void supabase.removeChannel(channel);
    };
  }, [configured, refreshProfiles]);

  return (
    <div className="members-grid">
      {items.map(({ member, proposed, listened }, index) => {
        const avatar = avatarUrl(member.username ? profiles[member.username] : undefined);
        return (
          <Link href={`/membres/${member.slug}`} key={member.slug} className="member-card">
            <span className="member-card__number">{String(index + 1).padStart(2, "0")}</span>
            <div className="member-card__avatar">
              {avatar ? <Image src={avatar} alt={`Photo de ${member.displayName}`} width={160} height={160} /> : member.displayName.slice(0, 1)}
            </div>
            <h2>{member.displayName}</h2>
            <p>{member.role === "admin" ? "Membre (admin)" : "Membre"}</p>
            <small>{proposed} proposition{proposed > 1 ? "s" : ""} · {listened} écoute{listened > 1 ? "s" : ""}</small>
          </Link>
        );
      })}
    </div>
  );
}