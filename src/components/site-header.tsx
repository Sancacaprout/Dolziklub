"use client";

import type { AuthChangeEvent } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { createDeferredAuthSync } from "@/lib/supabase/deferred-auth-sync";

const links = [["Accueil", "/"], ["Albums", "/albums"], ["Membres", "/membres"], ["Classements", "/classements"], ["Le Tribunal", "/tribunal"], ["Mises \u{00E0} jour", "/mises-a-jour"], ["Idées", "/idees"], ["Mèmes", "/memes"]] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [accountLabel, setAccountLabel] = useState("Connexion");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    let request: AbortController | null = null;
    let verifiedActor: string | null = null;
    const sync = async () => {
      request?.abort();
      const next = new AbortController();
      request = next;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (next.signal.aborted) return;
        const username = user?.app_metadata?.username;
        setAccountLabel(user ? (typeof username === "string" && username ? `@${username}` : "Mon compte") : "Connexion");
        if (user?.id !== verifiedActor) setIsAdmin(false);
        verifiedActor = user?.id ?? null;
        if (!user) return;
        const response = await fetch("/api/admin/access", { cache: "no-store", signal: next.signal });
        const result = response.ok ? await response.json() : null;
        if (!next.signal.aborted) setIsAdmin(result?.admin === true);
      } catch {
        if (!next.signal.aborted) setIsAdmin(false);
      }
    };
    const deferredSync = createDeferredAuthSync(sync);
    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "SIGNED_OUT") {
        request?.abort();
        verifiedActor = null;
        setIsAdmin(false);
        setAccountLabel("Connexion");
      }
      deferredSync.schedule();
    });
    deferredSync.schedule();
    const onFocus = () => deferredSync.schedule();
    window.addEventListener("focus", onFocus);
    return () => {
      request?.abort();
      deferredSync.cancel();
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const accountHref = accountLabel === "Connexion" ? "/connexion" : "/compte";

  return <header className="site-header"><Link href="/" className="logo" onClick={() => setOpen(false)}>DOL <i>ZIKLUB</i></Link><button className="menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="main-nav">Menu</button><nav id="main-nav" className={open ? "open" : ""}>{links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}{isAdmin ? <Link className="admin-nav-link" href="/admin" prefetch={false} onClick={() => setOpen(false)}>ADMIN</Link> : null}<Link href="/tableur" onClick={() => setOpen(false)}>Tableur</Link><Link href={accountHref} onClick={() => setOpen(false)}>{accountLabel}</Link><Link className="random-link" href="/hasard" onClick={() => setOpen(false)}>Album au hasard ↗</Link></nav></header>;
}
