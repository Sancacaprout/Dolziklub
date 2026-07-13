"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Kouize = { default_style?: string; dislikes?: string; curious_about?: string; first_hook?: string; note?: string };
type Profile = { avatar_path: string | null; bio: string | null; kouize: Kouize; updated_at: string | null; profile_color: string | null };

const labels: Array<[keyof Kouize, string]> = [["default_style", "Par défaut"], ["dislikes", "À éviter"], ["curious_about", "Curieux(se) d’écouter"], ["first_hook", "Ce qui attire d’abord"]];
function readKouize(input: unknown): Kouize { return input && typeof input === "object" && !Array.isArray(input) ? input as Kouize : {}; }
function normaliseColor(input: string | null | undefined) { return input && /^#[0-9A-Fa-f]{6}$/.test(input) ? input : "#c8ff00"; }
function isDark(color: string) { const [r, g, b] = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((value) => Number.parseInt(value, 16)); return ((r * 299) + (g * 587) + (b * 114)) / 1000 < 145; }

export function MemberPublicProfile({ displayName, username, role }: { displayName: string; username: string | null; role: "admin" | "member" }) {
  const configured = isSupabaseConfigured();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!configured || !username) return;
    const supabase = getSupabaseBrowserClient();
    const refreshProfile = async () => {
      const { data } = await supabase.from("member_public_profiles").select("avatar_path, bio, kouize, updated_at, profile_color").eq("username", username).maybeSingle();
      if (data) setProfile({ avatar_path: data.avatar_path, bio: data.bio, kouize: readKouize(data.kouize), updated_at: data.updated_at, profile_color: data.profile_color });
    };
    void refreshProfile();
    const channel = supabase.channel(`member-profile-${username}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "member_public_profiles", filter: `username=eq.${username}` }, () => void refreshProfile()).subscribe();
    window.addEventListener("focus", refreshProfile);
    return () => { window.removeEventListener("focus", refreshProfile); void supabase.removeChannel(channel); };
  }, [configured, username]);

  const avatar = profile?.avatar_path ? `${getSupabaseBrowserClient().storage.from("member-avatars").getPublicUrl(profile.avatar_path).data.publicUrl}?v=${encodeURIComponent(profile.updated_at ?? profile.avatar_path)}` : null;
  const answers = profile ? labels.filter(([key]) => profile.kouize[key]).map(([key, label]) => ({ label, value: profile.kouize[key] })) : [];
  const kouizeNote = profile?.kouize.note;
  const profileColor = normaliseColor(profile?.profile_color);
  const foreground = isDark(profileColor) ? "#f5f1e8" : "#111111";
  return <><section className="member-profile"><div className="member-profile__initial member-profile__avatar">{avatar ? <Image src={avatar} alt={`Affiche de ${displayName}`} width={220} height={220} /> : displayName[0]}</div><div><p className="eyebrow">MEMBRE DU DOL ZIKLUB</p><h1>{displayName}</h1><p>{role === "admin" ? "Membre (admin)" : "Membre"} · @{username}</p></div></section>{(profile?.bio || answers.length > 0 || kouizeNote) && <section className="member-kouize" style={{ backgroundColor: profileColor, color: foreground }}><div><p className="eyebrow">KOUIZE DE {displayName.toUpperCase()}</p><h2>Ce qui lui<br/><em>fait tendre l’oreille.</em></h2>{profile?.bio && <p className="member-kouize__bio">{profile.bio}</p>}</div><div className="member-kouize__answers">{answers.map((answer) => <div key={answer.label}><span>{answer.label}</span><b>{answer.value}</b></div>)}{kouizeNote && <p>“{kouizeNote}”</p>}</div></section>}</>;
}
