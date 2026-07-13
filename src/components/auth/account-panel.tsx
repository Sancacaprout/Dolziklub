"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Account = { username: string; displayName: string; role: string } | null;

export function AccountPanel() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [account, setAccount] = useState<Account>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setAccount({
        username: typeof user.app_metadata.username === "string" ? user.app_metadata.username : "membre",
        displayName: typeof user.app_metadata.display_name === "string" ? user.app_metadata.display_name : "Membre du Dol Ziklub",
        role: user.app_metadata.role === "admin" ? "Administrateur" : "Membre",
      });
      setLoading(false);
    };
    void load();
  }, [configured]);

  const signOut = async () => {
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/connexion");
    router.refresh();
  };

  if (!configured) return <section className="auth-panel"><p className="eyebrow">COMPTE</p><h2>Connexion en attente.</h2><p>La base sécurisée du club n’est pas encore reliée.</p><Link className="button" href="/connexion">Retour à la connexion</Link></section>;
  if (loading) return <section className="auth-panel"><p className="eyebrow">COMPTE</p><h2>Vérification du disque…</h2></section>;
  if (!account) return <section className="auth-panel"><p className="eyebrow">COMPTE</p><h2>Tu n’es pas connecté.</h2><p>Connecte-toi avec les identifiants transmis par le club.</p><Link className="button" href="/connexion">Se connecter</Link></section>;

  return <section className="auth-panel"><p className="eyebrow">COMPTE DOL ZIKLUB</p><h2>Salut, {account.displayName}.</h2><div className="account-card"><span>@{account.username}</span><b>{account.role}</b></div><p>Ta session est active sur cet appareil. Les zones privées du club utiliseront ce compte et ses droits.</p><button className="button button--dark" type="button" onClick={signOut}>Se déconnecter</button></section>;
}
