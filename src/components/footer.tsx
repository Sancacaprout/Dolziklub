"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { createDeferredAuthSync } from "@/lib/supabase/deferred-auth-sync";

const paypalUrl = "https://paypal.me/TMeyro";

export function Footer() {
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    const syncAdmin = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setIsAdmin(false); return; }
      const { data } = await supabase.from("member_profiles").select("role").eq("id", user.id).maybeSingle();
      if (active) setIsAdmin(data?.role === "admin");
    };
    void syncAdmin();
    const deferredSync = createDeferredAuthSync(syncAdmin);
    const { data: listener } = getSupabaseBrowserClient().auth.onAuthStateChange(deferredSync.schedule);
    return () => { active = false; deferredSync.cancel(); listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!isSupportOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSupportOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isSupportOpen]);

  return <><footer className="footer footer--site"><div className="footer-brand"><Link href="/">DOL ZIKLUB</Link><p>Le club où les albums circulent, les avis comptent et les archives restent vivantes.</p><span>ARCHIVES MUSICALES COLLECTIVES</span></div><nav className="footer-column" aria-label="Explorer le site"><h2>Explorer</h2><div className="footer-links"><Link href="/albums">Les albums</Link><Link href="/classements">Les classements</Link><Link href="/membres">Les membres</Link><Link href="/concept">Le concept</Link><Link href="/mises-a-jour">Mises à jour</Link></div></nav><nav className="footer-column" aria-label="Vie du club"><h2>Le club</h2><div className="footer-links"><Link href="/hasard">Le tirage</Link><Link href="/memes">Les mèmes</Link><Link href="/tableur">Le tableur</Link><Link href="/idees">Boîte à idées</Link><Link href="/compte">Mon compte</Link></div></nav><div className="footer-support"><span className="footer-support__eyebrow">SOUTENIR LE PROJET</span><button className="coffee-button" type="button" onClick={() => setIsSupportOpen(true)}>☕ Buy me a coffee</button></div><div className="footer-bottom"><small>© {new Date().getFullYear()} DOL ZIKLUB — Les pochettes appartiennent à leurs ayants droit.</small><nav className="footer-legal" aria-label="Informations légales"><Link href="/confidentialite">Confidentialité</Link><Link href="/conditions">Conditions d’utilisation</Link><Link href="/cookies">Cookies</Link>{isAdmin && <Link href="/signalements">Signalements admin</Link>}</nav></div></footer>{isSupportOpen && <div className="coffee-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsSupportOpen(false); }}><section className="coffee-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="coffee-modal-title"><button className="coffee-modal__close" type="button" onClick={() => setIsSupportOpen(false)} aria-label="Fermer la fenêtre de soutien">×</button><span>SOUTENIR LE KLUB</span><h2 id="coffee-modal-title">Un café pour le club ?</h2><p>Choisis simplement la méthode qui t’arrange.</p><div className="coffee-modal__choices"><a className="coffee-modal__link" href={paypalUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Ouvrir PayPal <b aria-hidden="true">↗</b></a><div className="coffee-modal__qr"><Image src="/paypal-qrcode.png" alt="QR code PayPal pour soutenir le Dol Ziklub" width={176} height={176} /><small>Ou scanne ce QR code.</small></div></div></section></div>}</>;
}