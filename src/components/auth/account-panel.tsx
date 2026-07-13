"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Kouize = { default_style: string; dislikes: string; curious_about: string; first_hook: string; note: string };
type Account = { id: string; username: string; displayName: string; role: string; avatarPath: string | null; profileColor: string } | null;
type PublicProfile = { avatar_path: string | null; bio: string | null; kouize: unknown; profile_color: string | null };
type Rgb = { r: number; g: number; b: number };

const emptyKouize: Kouize = { default_style: "", dislikes: "", curious_about: "", first_hook: "", note: "" };
const styles = ["", "Rap", "Hip-hop", "Pop", "Instrumental", "Classique", "Jazz", "Métal", "RnB", "Rock", "Folk", "Expérimental", "Autre"];
const hooks = ["", "La mélodie", "La rythmique", "Les paroles", "L’ambiance", "La prod", "L’émotion", "Autre"];
const avatarTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const defaultProfileColor = "#c8ff00";

function normaliseKouize(input: unknown): Kouize {
  if (!input || typeof input !== "object" || Array.isArray(input)) return emptyKouize;
  const source = input as Record<string, unknown>;
  return Object.fromEntries(Object.keys(emptyKouize).map((key) => [key, typeof source[key] === "string" ? source[key] : ""])) as Kouize;
}

function normaliseColor(input: string | null | undefined) { return input && /^#[0-9A-Fa-f]{6}$/.test(input) ? input.toUpperCase() : defaultProfileColor; }
function rgbFromHex(color: string): Rgb { return { r: Number.parseInt(color.slice(1, 3), 16), g: Number.parseInt(color.slice(3, 5), 16), b: Number.parseInt(color.slice(5, 7), 16) }; }
function hexFromRgb({ r, g, b }: Rgb) { return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("").toUpperCase()}`; }
function isDark(color: string) { const { r, g, b } = rgbFromHex(color); return ((r * 299) + (g * 587) + (b * 114)) / 1000 < 145; }
function avatarUrl(path: string | null) { return path ? getSupabaseBrowserClient().storage.from("member-avatars").getPublicUrl(path).data.publicUrl : null; }

export function AccountPanel() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [account, setAccount] = useState<Account>(null);
  const [bio, setBio] = useState("");
  const [kouize, setKouize] = useState<Kouize>(emptyKouize);
  const [hexInput, setHexInput] = useState(defaultProfileColor);
  const [loading, setLoading] = useState(configured);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!configured) return;
    const timer = window.setTimeout(() => { void (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) { setLoading(false); return; }
      const username = typeof user.app_metadata.username === "string" ? user.app_metadata.username : "membre";
      const { data: profile } = await supabase.from("member_public_profiles").select("avatar_path, bio, kouize, profile_color").eq("id", user.id).maybeSingle();
      const detail = profile as PublicProfile | null;
      const profileColor = normaliseColor(detail?.profile_color);
      setAccount({ id: user.id, username, displayName: typeof user.app_metadata.display_name === "string" ? user.app_metadata.display_name : "Membre du Dol Ziklub", role: user.app_metadata.role === "admin" ? "Administrateur" : "Membre", avatarPath: detail?.avatar_path ?? null, profileColor });
      setHexInput(profileColor); setBio(detail?.bio ?? ""); setKouize(normaliseKouize(detail?.kouize)); setLoading(false);
    })(); }, 0);
    return () => window.clearTimeout(timer);
  }, [configured]);

  const updateColor = (color: string) => {
    if (!account) return;
    const normalised = normaliseColor(color);
    setAccount({ ...account, profileColor: normalised });
    setHexInput(normalised);
  };

  const updateRgb = (key: keyof Rgb, input: string) => {
    if (!account) return;
    const rgb = rgbFromHex(account.profileColor);
    rgb[key] = Number.isFinite(Number(input)) ? Math.max(0, Math.min(255, Number(input))) : 0;
    updateColor(hexFromRgb(rgb));
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!account) return;
    setSaving(true); setMessage("");
    const { error } = await getSupabaseBrowserClient().from("member_public_profiles").upsert({ id: account.id, username: account.username, avatar_path: account.avatarPath, bio: bio.trim() || null, kouize, profile_color: account.profileColor }, { onConflict: "id" });
    setSaving(false); setMessage(error ? "Le profil n’a pas pu être enregistré." : "Profil, Kouize et couleur enregistrés.");
  };

  const uploadAvatar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!account) return;
    const file = new FormData(event.currentTarget).get("avatar") as File | null;
    if (!file || file.size === 0) { setMessage("Choisis une image pour ton affiche."); return; }
    if (!avatarTypes.has(file.type) || file.size > 3 * 1024 * 1024) { setMessage("Choisis une image JPG, PNG, WebP ou GIF de 3 Mo maximum."); return; }
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${account.id}/avatar-${Date.now()}.${extension}`;
    setUploading(true); setMessage("");
    const supabase = getSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage.from("member-avatars").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (uploadError) { setUploading(false); setMessage("L’affiche n’a pas pu être envoyée."); return; }
    const { error: profileError } = await supabase.from("member_public_profiles").upsert({ id: account.id, username: account.username, avatar_path: path, bio: bio.trim() || null, kouize, profile_color: account.profileColor }, { onConflict: "id" });
    if (profileError) { await supabase.storage.from("member-avatars").remove([path]); setMessage("L’affiche a été envoyée, mais le profil n’a pas pu être mis à jour."); }
    else { setAccount({ ...account, avatarPath: path }); setMessage("Nouvelle affiche enregistrée."); }
    setUploading(false);
  };

  const signOut = async () => { await getSupabaseBrowserClient().auth.signOut(); router.push("/connexion"); router.refresh(); };
  const photo = account ? avatarUrl(account.avatarPath) : null;
  if (!configured) return <section className="auth-panel"><p className="eyebrow">COMPTE</p><h2>Connexion en attente.</h2><p>La base sécurisée du club n’est pas encore reliée.</p><Link className="button" href="/connexion">Retour à la connexion</Link></section>;
  if (loading) return <section className="auth-panel"><p className="eyebrow">COMPTE</p><h2>Vérification du disque…</h2></section>;
  if (!account) return <section className="auth-panel"><p className="eyebrow">COMPTE</p><h2>Tu n’es pas connecté.</h2><p>Connecte-toi avec les identifiants transmis par le club.</p><Link className="button" href="/connexion">Se connecter</Link></section>;

  const rgb = rgbFromHex(account.profileColor);
  const foreground = isDark(account.profileColor) ? "#f5f1e8" : "#111111";
  return <section className="account-page"><section className="member-profile account-member-profile"><div className="member-profile__initial member-profile__avatar">{photo ? <Image src={photo} alt={`Affiche de ${account.displayName}`} width={220} height={220} /> : account.displayName.slice(0, 1)}</div><div><p className="eyebrow">COMPTE DOL ZIKLUB</p><h1>{account.displayName}</h1><p>{account.role === "Administrateur" ? "Membre (admin)" : "Membre"} · @{account.username}</p></div></section><form className="avatar-form" onSubmit={uploadAvatar}><label>Changer mon affiche<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required /></label><button className="button" type="submit" disabled={uploading}>{uploading ? "Envoi…" : "Mettre à jour la photo"}</button></form><form className="member-kouize account-kouize-editor" onSubmit={saveProfile} style={{ backgroundColor: account.profileColor, color: foreground }}><div><p className="eyebrow">MON KOUIZE</p><h2>Ce qui me<br/><em>fait tendre l’oreille.</em></h2><label className="account-field">Mini bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} placeholder="Une ligne pour te présenter au club…" /></label><fieldset className="color-panel"><legend>Couleur de fond de ma fiche</legend><div className="color-panel__top"><input aria-label="Choisir la couleur" type="color" value={account.profileColor} onChange={(event) => updateColor(event.target.value)} /><span className="color-panel__swatch" style={{ backgroundColor: account.profileColor }} /></div><label>HEX <input value={hexInput} onChange={(event) => { const value = event.target.value.toUpperCase(); setHexInput(value); if (/^#[0-9A-F]{6}$/.test(value)) updateColor(value); }} maxLength={7} placeholder="#C8FF00" /></label><div className="color-panel__rgb"><label>R <input type="number" min="0" max="255" value={rgb.r} onChange={(event) => updateRgb("r", event.target.value)} /></label><label>G <input type="number" min="0" max="255" value={rgb.g} onChange={(event) => updateRgb("g", event.target.value)} /></label><label>B <input type="number" min="0" max="255" value={rgb.b} onChange={(event) => updateRgb("b", event.target.value)} /></label></div></fieldset></div><div className="member-kouize__answers account-kouize-fields"><label>Ce que j’écoute le plus par défaut<select value={kouize.default_style} onChange={(event) => setKouize({ ...kouize, default_style: event.target.value })}>{styles.map((style) => <option key={style || "empty"} value={style}>{style || "Choisir un style"}</option>)}</select></label><label>Ce que je n’aime vraiment pas<input value={kouize.dislikes} onChange={(event) => setKouize({ ...kouize, dislikes: event.target.value })} maxLength={120} placeholder="Ex. autotune bien dégueu" /></label><label>Ce que je suis curieux(se) d’écouter<select value={kouize.curious_about} onChange={(event) => setKouize({ ...kouize, curious_about: event.target.value })}>{styles.map((style) => <option key={style || "empty"} value={style}>{style || "Choisir un style"}</option>)}</select></label><label>Ce qui m’attire en premier<select value={kouize.first_hook} onChange={(event) => setKouize({ ...kouize, first_hook: event.target.value })}>{hooks.map((hook) => <option key={hook || "empty"} value={hook}>{hook || "Choisir un élément"}</option>)}</select></label><label>Précision libre<textarea value={kouize.note} onChange={(event) => setKouize({ ...kouize, note: event.target.value })} maxLength={280} placeholder="Une nuance, un contre-exemple, une obsession du moment…" /></label><button className="button" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer ma fiche"}</button></div></form>{message && <p className="account-message" role="status">{message}</p>}<button className="text-link account-signout" type="button" onClick={signOut}>Se déconnecter</button></section>;
}
