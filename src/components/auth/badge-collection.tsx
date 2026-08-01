"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeArt } from "@/components/badge-art";
import type { BadgeCollectionPayload, BadgeKey, MemberBadge } from "@/lib/badges/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const stateLabels = { unlocked_unclaimed:"À réclamer",equipped:"Équipés",claimed:"Débloqués",locked:"À découvrir" } as const;
const stateOrder: MemberBadge["state"][] = ["unlocked_unclaimed","equipped","claimed","locked"];

export function BadgeCollection() {
  const [collection,setCollection] = useState<BadgeCollectionPayload | null>(null);
  const [loading,setLoading] = useState(isSupabaseConfigured());
  const [busy,setBusy] = useState<string | null>(null);
  const [message,setMessage] = useState("");
  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) return setLoading(false);
    const { data:auth } = await getSupabaseBrowserClient().auth.getUser();
    if (!auth.user) return setLoading(false);
    const { data,error } = await getSupabaseBrowserClient().rpc("get_my_badge_collection");
    if (!error && data) setCollection(data as BadgeCollectionPayload);
    else if (error) setMessage("La collection de badges est momentanément indisponible.");
    setLoading(false);
  },[]);
  useEffect(() => { const timer=window.setTimeout(() => void load(),0); return () => window.clearTimeout(timer); },[load]);
  const grouped = useMemo(() => Object.fromEntries(stateOrder.map((state) => [state,collection?.badges.filter((badge) => badge.state===state) ?? []])) as Record<MemberBadge["state"],MemberBadge[]>,[collection]);
  const claim = async (key:BadgeKey) => {
    setBusy(`claim:${key}`); setMessage("");
    const { error } = await getSupabaseBrowserClient().rpc("claim_my_badge",{ p_badge_key:key });
    if (error) setMessage("Ce badge n’a pas pu être réclamé.");
    else { setMessage("Badge ajouté à ta collection."); window.dispatchEvent(new Event("dol-badges-refresh")); await load(); }
    setBusy(null);
  };
  const equip = async (slot:1|2|3,key:BadgeKey|null) => {
    setBusy(`slot:${slot}`); setMessage("");
    const { data,error } = await getSupabaseBrowserClient().rpc("set_my_equipped_badge",{ p_slot:slot,p_badge_key:key });
    if (error) setMessage("Cet emplacement n’a pas pu être modifié.");
    else { setCollection(data as BadgeCollectionPayload); setMessage(key ? `Badge équipé dans l’emplacement ${slot}.` : `Emplacement ${slot} libéré.`); }
    setBusy(null);
  };
  if (loading) return <section className="page badge-collection"><p className="badge-collection__loading">Ouverture de la vitrine…</p></section>;
  if (!collection) return null;
  const equipped=collection.badges.filter((badge) => badge.state==="equipped");
  return <section className="page badge-collection" aria-labelledby="my-badges-heading">
    <header className="badge-collection__header"><div><p className="eyebrow">COLLECTION PERSONNELLE</p><h2 id="my-badges-heading">Mes badges</h2></div><p>{collection.badges.filter((badge) => badge.state!=="locked").length} / 29 débloqués</p></header>
    <section className="badge-slots" aria-labelledby="badge-slots-heading"><div><p className="eyebrow">PROFIL PUBLIC</p><h3 id="badge-slots-heading">Mes trois badges exposés</h3></div>
      <div className="badge-slots__grid">{([1,2,3] as const).map((slot) => { const badge=equipped.find((item) => item.slot===slot); return <article className="badge-slot" key={slot}><span>EMPLACEMENT {slot}</span>{badge ? <><BadgeArt imagePath={badge.imagePath} name={badge.name} rarity={badge.rarity} size={88}/><b>{badge.name}</b><button type="button" onClick={() => void equip(slot,null)} disabled={busy===`slot:${slot}`}>Retirer</button></> : <p>Libre</p>}</article>; })}</div>
    </section>
    {stateOrder.map((state) => grouped[state].length ? <section className={`badge-shelf badge-shelf--${state}`} key={state} aria-labelledby={`badges-${state}`}>
      <header><h3 id={`badges-${state}`}>{stateLabels[state]}</h3><span>{grouped[state].length}</span></header><div className="badge-grid">
      {grouped[state].map((badge) => { const progress=badge.progress; const ratio=progress ? Math.min(100,Math.round((progress.current/Math.max(progress.target,1))*100)) : 0; return <article className={`badge-card badge-card--${badge.rarity} is-${badge.state}`} key={badge.key}>
        <BadgeArt imagePath={badge.imagePath} name={badge.name} rarity={badge.rarity} locked={badge.state==="locked"}/><div className="badge-card__copy"><span>{badge.category}</span><h4>{badge.name}</h4><p>{badge.description}</p></div>
        {progress && badge.state==="locked" ? <div className="badge-progress" aria-label={`${progress.current} sur ${progress.target}`}><span style={{ width:`${ratio}%` }}/><small>{progress.current} / {progress.target}</small></div> : null}
        {badge.state==="unlocked_unclaimed" ? <button className="button" type="button" onClick={() => void claim(badge.key)} disabled={busy===`claim:${badge.key}`}>Réclamer</button> : null}
        {badge.state==="claimed" || badge.state==="equipped" ? <div className="badge-card__slots" aria-label="Choisir un emplacement">{([1,2,3] as const).map((slot) => <button className={badge.slot===slot ? "is-active" : ""} type="button" key={slot} onClick={() => void equip(slot,badge.key)} disabled={busy===`slot:${slot}`}>{slot}</button>)}</div> : null}
      </article>; })}</div></section> : null)}
    {message ? <p className="badge-collection__message" role="status">{message}</p> : null}
  </section>;
}
