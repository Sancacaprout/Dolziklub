"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Colors = { proposals: string; listens: string; given_average: string };
type Metrics = { proposed_count: number; listened_count: number; given_count: number; given_sum: number; received_count: number; received_sum: number };
const defaults: Colors = { proposals: "#CCF51D", listens: "#CCF51D", given_average: "#CCF51D" };
const format = (value: number | null) => value === null ? "—" : value.toFixed(1).replace(".", ",");
const color = (input: unknown, fallback: string) => typeof input === "string" && /^#[0-9A-Fa-f]{6}$/.test(input) ? input : fallback;

export function MemberStatsCards({ username, base }: { username: string; base: { proposed: number; listened: number; givenAverage: number | null; givenCount: number; receivedAverage: number | null; receivedCount: number } }) {
  const configured = isSupabaseConfigured(); const [colors, setColors] = useState<Colors>(defaults); const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffect(() => { if (!configured) return; const supabase = getSupabaseBrowserClient(); void Promise.all([supabase.from("member_public_profiles").select("stat_colors").eq("username", username).maybeSingle(), supabase.rpc("get_public_member_draw_metrics", { p_username: username })]).then(([profile, result]) => { const source = profile.data?.stat_colors && typeof profile.data.stat_colors === "object" ? profile.data.stat_colors as Record<string, unknown> : {}; setColors({ proposals: color(source.proposals, defaults.proposals), listens: color(source.listens, defaults.listens), given_average: color(source.given_average, defaults.given_average) }); if (!result.error && result.data?.[0]) setMetrics(result.data[0] as Metrics); }); }, [configured, username]);
  const proposed = base.proposed + Number(metrics?.proposed_count ?? 0); const listened = base.listened + Number(metrics?.listened_count ?? 0); const givenCount = base.givenCount + Number(metrics?.given_count ?? 0); const receivedCount = base.receivedCount + Number(metrics?.received_count ?? 0); const givenAverage = givenCount ? ((base.givenAverage ?? 0) * base.givenCount + Number(metrics?.given_sum ?? 0)) / givenCount : null; const receivedAverage = receivedCount ? ((base.receivedAverage ?? 0) * base.receivedCount + Number(metrics?.received_sum ?? 0)) / receivedCount : null;
  return <div className="stat-cards"><div style={{ backgroundColor: colors.proposals }}><b>{proposed}</b><span>propositions</span></div><div style={{ backgroundColor: colors.listens }}><b>{listened}</b><span>écoutes</span></div><div style={{ backgroundColor: colors.given_average }}><b>{format(givenAverage)}</b><span className="stat-cards__label">Note moyenne attribuée</span></div><div><b>{format(receivedAverage)}</b><span className="stat-cards__label">Note moyenne obtenue</span></div></div>;
}
