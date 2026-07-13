"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { usernameToInternalEmail } from "@/lib/auth/username";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function LoginPanel() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured) return;
    setMessage("");
    setLoading(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email: usernameToInternalEmail(username),
        password,
      });
      if (error) {
        setMessage("Identifiant ou mot de passe incorrect.");
        return;
      }
      router.push("/compte");
      router.refresh();
    } catch {
      setMessage("Identifiant invalide. Utilise celui qui t’a été transmis par le club.");
    } finally {
      setLoading(false);
    }
  };

  if (!configured) return <section className="auth-panel"><p className="eyebrow">ACCÈS MEMBRE</p><h2>La porte est prête.</h2><p>La connexion sera activée dès que la base sécurisée du club sera reliée. Aucun mot de passe n’est stocké dans le site ni dans Git.</p><p className="notice">L’administrateur doit terminer le raccordement Supabase avant de distribuer les identifiants.</p></section>;

  return <section className="auth-panel"><p className="eyebrow">ACCÈS MEMBRE</p><h2>Entre dans le Ziklub.</h2><p>Utilise l’identifiant et le mot de passe qui t’ont été transmis. Ton adresse e-mail interne n’est jamais demandée.</p><form className="auth-form" onSubmit={handleSubmit}><label>Identifiant<input name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>Mot de passe<input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message && <p className="auth-form__message" role="alert">{message}</p>}<button className="button" type="submit" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button></form><p className="auth-panel__foot">Mot de passe perdu ? Demande une réinitialisation à l’administration du club.</p><Link className="text-link" href="/membres">Voir les membres</Link></section>;
}
