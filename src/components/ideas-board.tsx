"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Idea = { id: string; author_id: string; author_username: string; author_display_name: string; content: string; created_at: string };
type Profile = { id: string; role: "member" | "admin"; username: string; display_name: string };

function dateLabel(value: string) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)); }

export function IdeasBoard() {
  const configured = isSupabaseConfigured();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ideaText, setIdeaText] = useState("");
  const [reportCategory, setReportCategory] = useState<"bug" | "report">("bug");
  const [reportSubject, setReportSubject] = useState("");
  const [reportText, setReportText] = useState("");
  const [mode, setMode] = useState<"ideas" | "report">("ideas");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const loadIdeas = useCallback(async () => {
    if (!configured) return;
    const { data, error } = await getSupabaseBrowserClient().from("club_ideas").select("id, author_id, author_username, author_display_name, content, created_at").order("created_at", { ascending: false }).limit(100);
    if (error) setMessage("La boîte à idées n’est pas encore disponible.");
    else setIdeas((data ?? []) as Idea[]);
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    let active = true;
    const sync = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(user?.id ?? null);
      if (!user) { setProfile(null); return; }
      const { data } = await supabase.from("member_profiles").select("id, role, username, display_name").eq("id", user.id).maybeSingle();
      if (active) setProfile((data ?? null) as Profile | null);
    };
    const initialLoad = window.setTimeout(() => { void sync(); void loadIdeas(); }, 0);
    const { data: listener } = supabase.auth.onAuthStateChange(() => void sync());
    return () => { active = false; window.clearTimeout(initialLoad); listener.subscription.unsubscribe(); };
  }, [configured, loadIdeas]);

  const submitIdea = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) { setMessage("Connecte-toi pour proposer une idée."); return; }
    if (ideaText.trim().length < 3) { setMessage("Écris une idée un peu plus détaillée."); return; }
    setSaving(true); setMessage("");
    const { error } = await getSupabaseBrowserClient().from("club_ideas").insert({ content: ideaText.trim() });
    setSaving(false);
    if (error) { setMessage("Impossible d’ajouter cette idée pour le moment."); return; }
    setIdeaText(""); setMessage("Idée ajoutée à la boîte du club."); void loadIdeas();
  };

  const deleteIdea = async (id: string) => {
    const { error } = await getSupabaseBrowserClient().from("club_ideas").delete().eq("id", id);
    if (error) { setMessage("Cette idée ne peut pas être supprimée."); return; }
    setIdeas((current) => current.filter((idea) => idea.id !== id));
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) { setMessage("Connecte-toi pour envoyer un signalement."); return; }
    if (reportSubject.trim().length < 3 || reportText.trim().length < 10) { setMessage("Ajoute un titre et quelques détails au signalement."); return; }
    setSaving(true); setMessage("");
    const { error } = await getSupabaseBrowserClient().from("club_reports").insert({ category: reportCategory, subject: reportSubject.trim(), content: reportText.trim() });
    setSaving(false);
    if (error) { setMessage("Impossible d’envoyer le signalement pour le moment."); return; }
    setReportSubject(""); setReportText(""); setMessage("Signalement envoyé : seuls les administrateurs peuvent le consulter.");
  };

  return <section className="feedback-board"><div className="feedback-board__switch" role="tablist" aria-label="Participer au club"><button type="button" className={mode === "ideas" ? "is-active" : ""} onClick={() => setMode("ideas")} role="tab" aria-selected={mode === "ideas"}>Boîte à idées</button><button type="button" className={mode === "report" ? "is-active" : ""} onClick={() => setMode("report")} role="tab" aria-selected={mode === "report"}>Signaler un souci</button></div>{mode === "ideas" ? <div className="ideas-layout"><div><form className="feedback-form" onSubmit={submitIdea}><label>Une idée pour le club<textarea value={ideaText} onChange={(event) => setIdeaText(event.target.value)} maxLength={1000} placeholder="Une fonction, une règle, une envie pour le club…" /></label><button className="button" type="submit" disabled={saving}>{saving ? "Ajout…" : "Ajouter mon idée"}</button>{!userId && <p>Il faut être <Link href="/connexion">connecté</Link> pour publier.</p>}</form>{message && <p className="feedback-message" role="status">{message}</p>}</div><ol className="ideas-list">{ideas.length ? ideas.map((idea) => { const canDelete = idea.author_id === userId || profile?.role === "admin"; return <li key={idea.id}><div><p>{idea.content}</p><span><b>{idea.author_display_name}</b> · @{idea.author_username} · {dateLabel(idea.created_at)}</span></div>{canDelete && <button type="button" onClick={() => void deleteIdea(idea.id)}>Supprimer</button>}</li>; }) : <li className="ideas-list__empty">Pas encore d’idée publiée. Lance le mouvement.</li>}</ol></div> : <form className="feedback-form feedback-form--report" onSubmit={submitReport}><p>Les signalements sont privés : seuls les administrateurs y ont accès.</p><label>Type<select value={reportCategory} onChange={(event) => setReportCategory(event.target.value as "bug" | "report")}><option value="bug">Bug technique</option><option value="report">Signalement</option></select></label><label>Titre<input value={reportSubject} onChange={(event) => setReportSubject(event.target.value)} maxLength={140} placeholder="Ex. le bouton ne répond pas" /></label><label>Décris le problème<textarea value={reportText} onChange={(event) => setReportText(event.target.value)} maxLength={2000} placeholder="Ce que tu faisais, ce qui s’est passé, et si possible l’appareil utilisé…" /></label><button className="button" type="submit" disabled={saving}>{saving ? "Envoi…" : "Envoyer le signalement"}</button>{!userId && <p>Il faut être <Link href="/connexion">connecté</Link> pour envoyer un signalement.</p>}{message && <p className="feedback-message" role="status">{message}</p>}</form>}</section>;
}