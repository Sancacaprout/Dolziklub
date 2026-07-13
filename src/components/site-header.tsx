"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const links = [["Albums", "/albums"], ["Membres", "/membres"], ["Classements", "/classements"], ["Mêmes", "/memes"], ["Le concept", "/concept"]] as const;
const clubSheetUrl = "https://docs.google.com/spreadsheets/d/1xdhbz6kRsdhEsdQIuZ7TbRbJ_umvfacopPLpYFRqrRI/edit?usp=sharing";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [accountLabel, setAccountLabel] = useState("Connexion");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    const sync = async () => {
      const { data } = await supabase.auth.getUser();
      setAccountLabel(data.user?.app_metadata?.username ? `@${data.user.app_metadata.username}` : "Mon compte");
    };
    void sync();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void sync());
    return () => listener.subscription.unsubscribe();
  }, []);

  const accountHref = accountLabel === "Connexion" ? "/connexion" : "/compte";

  return <header className="site-header"><Link href="/" className="logo" onClick={() => setOpen(false)}>DOL <i>ZIKLUB</i></Link><button className="menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="main-nav">Menu</button><nav id="main-nav" className={open ? "open" : ""}>{links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}<a href={clubSheetUrl} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Tableur ↗</a><Link href={accountHref} onClick={() => setOpen(false)}>{accountLabel}</Link><Link className="random-link" href="/hasard" onClick={() => setOpen(false)}>Album au hasard ↗</Link></nav></header>;
}
