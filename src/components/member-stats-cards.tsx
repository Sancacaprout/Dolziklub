"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Colors = { proposals: string; listens: string; given_average: string };
type MemberStatsBase = {
  proposed: number;
  listened: number;
  givenAverage: number | null;
  receivedAverage: number | null;
};

const defaults: Colors = { proposals: "#CCF51D", listens: "#CCF51D", given_average: "#CCF51D" };
const format = (value: number | null) => value === null ? "—" : value.toFixed(1).replace(".", ",");
const color = (input: unknown, fallback: string) => typeof input === "string" && /^#[0-9A-Fa-f]{6}$/.test(input) ? input : fallback;

export function MemberStatsCards({ username, base }: { username: string; base: MemberStatsBase }) {
  const configured = isSupabaseConfigured();
  const [colors, setColors] = useState<Colors>(defaults);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    void supabase
      .from("member_public_profiles")
      .select("stat_colors")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }: { data: { stat_colors: unknown } | null }) => {
        const source = data?.stat_colors && typeof data.stat_colors === "object"
          ? data.stat_colors as Record<string, unknown>
          : {};
        const unified = color(
          source.unified ?? source.proposals ?? source.listens ?? source.given_average,
          defaults.proposals,
        );
        setColors({ proposals: unified, listens: unified, given_average: unified });
      });
  }, [configured, username]);

  const cardStyle = (value: string) => ({ "--member-stat-color": value } as CSSProperties);
  return (
    <div className="stat-cards">
      <div style={cardStyle(colors.proposals)}><b>{base.proposed}</b><span>propositions</span></div>
      <div style={cardStyle(colors.listens)}><b>{base.listened}</b><span>écoutes</span></div>
      <div style={cardStyle(colors.given_average)}><b>{format(base.givenAverage)}</b><span className="stat-cards__label">Note moyenne attribuée</span></div>
      <div style={cardStyle(colors.given_average)}><b>{format(base.receivedAverage)}</b><span className="stat-cards__label">Note moyenne obtenue</span></div>
    </div>
  );
}