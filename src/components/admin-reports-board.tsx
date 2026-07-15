"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Profile = { role: "member" | "admin" };
type Report = { id: string; author_display_name: string; author_username: string; category: "bug" | "report"; subject: string; content: string; status: "open" | "in_progress" | "resolved"; created_at: string };
const statusLabel = { open: "Nouveau", in_progress: "En cours", resolved: "Résolu" } as const;

export function AdminReportsBoard() {
  const configured = isSupabaseConfigured();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
    const { data, error } = await getSupabaseBrowserClient().from("club_reports").select("id, author_display_name, author_username, category, subject, content, status, created_at").order("created_at", { ascending: false }).limit(250);
    if (error) { setError("Impossible de charger les signalements."); return; }
    setReports((data ?? []) as Report[]);
  };

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) { setProfile(null); setLoading(false); } return; }
      const { data } = await supabase.from("member_profiles").select("role").eq("id", user.id).maybeSingle();
      const nextProfile = (data ?? null) as Profile | null;
      if (!active) return;
      setProfile(nextProfile);
      if (nextProfile?.role === "admin") await loadReports();
      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [configured]);

  const changeStatus = async (id: string, status: Report["status"]) => {
    const { error } = await getSupabaseBrowserClient().from("club_reports").update({ status }).eq("id", id);
    if (error) { setError("Le statut n’a pas pu être modifié."); return; }
    setReports((current) => current.map((report) => report.id === id ? { ...report, status } : report));
  };

  if (loading) return <p className="admin-reports__empty">Vérification de l’accès administrateur…</p>;
  if (profile?.role !== "admin") return <section className="admin-reports__empty"><b>Accès réservé à l’administration.</b><p>Les signalements ne sont pas visibles aux membres.</p></section>;
  return <section className="admin-reports"><p className="admin-reports__notice">Les messages affichés ici sont privés. Les auteurs ne voient pas cette liste.</p>{error && <p className="feedback-message">{error}</p>}{reports.length ? <ol>{reports.map((report) => <li key={report.id}><header><span className={`report-kind report-kind--${report.category}`}>{report.category === "bug" ? "BUG" : "SIGNALEMENT"}</span><time dateTime={report.created_at}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.created_at))}</time></header><h2>{report.subject}</h2><p>{report.content}</p><footer><span>{report.author_display_name} · @{report.author_username}</span><label>Statut<select value={report.status} onChange={(event) => void changeStatus(report.id, event.target.value as Report["status"])}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></footer></li>)}</ol> : <p className="admin-reports__empty">Aucun signalement pour l’instant.</p>}</section>;
}