"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

type Kouize = {
  default_style: string;
  dislikes: string;
  curious_about: string;
  first_hook: string;
  note: string;
};
type StatColors = { proposals: string; listens: string; given_average: string };
type Account = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  avatarPath: string | null;
  profileColor: string;
  statColors: StatColors;
} | null;
type PublicProfile = {
  avatar_path: string | null;
  bio: string | null;
  kouize: unknown;
  profile_color: string | null;
  stat_colors: unknown;
};
type Rgb = { r: number; g: number; b: number };

const emptyKouize: Kouize = {
  default_style: "",
  dislikes: "",
  curious_about: "",
  first_hook: "",
  note: "",
};
const defaultProfileColor = "#C8FF00";
const defaultStatColors: StatColors = {
  proposals: "#CCF51D",
  listens: "#CCF51D",
  given_average: "#CCF51D",
};
const styles = [
  "",
  "Rap",
  "Hip-hop",
  "Pop",
  "Instrumental",
  "Classique",
  "Jazz",
  "Métal",
  "RnB",
  "Rock",
  "Folk",
  "Expérimental",
  "Autre",
];
const hooks = [
  "",
  "La mélodie",
  "La rythmique",
  "Les paroles",
  "L’ambiance",
  "La prod",
  "L’émotion",
  "Autre",
];
const avatarTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function normaliseKouize(input: unknown): Kouize {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return emptyKouize;
  const source = input as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(emptyKouize).map((key) => [
      key,
      typeof source[key] === "string" ? source[key] : "",
    ]),
  ) as Kouize;
}
function normaliseColor(input: unknown, fallback = defaultProfileColor) {
  return typeof input === "string" && /^#[0-9A-Fa-f]{6}$/.test(input)
    ? input.toUpperCase()
    : fallback;
}
function normaliseStatColors(input: unknown): StatColors {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const unified = normaliseColor(
    source.unified ??
      source.proposals ??
      source.listens ??
      source.given_average,
    defaultStatColors.proposals,
  );
  return { proposals: unified, listens: unified, given_average: unified };
}
function rgbFromHex(color: string): Rgb {
  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
}
function isDark(color: string) {
  const { r, g, b } = rgbFromHex(color);
  return (r * 299 + g * 587 + b * 114) / 1000 < 145;
}
function avatarUrl(path: string | null) {
  return path
    ? getSupabaseBrowserClient()
        .storage.from("member-avatars")
        .getPublicUrl(path).data.publicUrl
    : null;
}

function StatColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="stat-color-control">
      <span>{label}</span>
      <div>
        <input
          aria-label={`Choisir la couleur ${label}`}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          value={value}
          maxLength={7}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

export function AccountPanel() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [account, setAccount] = useState<Account>(null);
  const [bio, setBio] = useState("");
  const [kouize, setKouize] = useState<Kouize>(emptyKouize);
  const [loading, setLoading] = useState(configured);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!configured) return;
    const timer = setTimeout(() => {
      void (async () => {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) {
          setLoading(false);
          return;
        }
        const username =
          typeof user.app_metadata.username === "string"
            ? user.app_metadata.username
            : "membre";
        const { data: profile } = await supabase
          .from("member_public_profiles")
          .select("avatar_path, bio, kouize, profile_color, stat_colors")
          .eq("id", user.id)
          .maybeSingle();
        const detail = profile as PublicProfile | null;
        const profileColor = normaliseColor(detail?.profile_color);
        setAccount({
          id: user.id,
          username,
          displayName:
            typeof user.app_metadata.display_name === "string"
              ? user.app_metadata.display_name
              : "Membre du Dol Ziklub",
          role:
            user.app_metadata.role === "admin" ? "Administrateur" : "Membre",
          avatarPath: detail?.avatar_path ?? null,
          profileColor,
          statColors: normaliseStatColors(detail?.stat_colors),
        });
        setBio(detail?.bio ?? "");
        setKouize(normaliseKouize(detail?.kouize));
        setLoading(false);
      })();
    }, 0);
    return () => clearTimeout(timer);
  }, [configured]);
  const updateColor = (color: string) => {
    if (!account) return;
    const profileColor = normaliseColor(color);
    setAccount({ ...account, profileColor });
  };
  const updateStatColor = (color: string) => {
    if (!account) return;
    const unified = normaliseColor(color, account.statColors.proposals);
    setAccount({
      ...account,
      statColors: {
        proposals: unified,
        listens: unified,
        given_average: unified,
      },
    });
  };
  const payload = () =>
    account && {
      id: account.id,
      username: account.username,
      avatar_path: account.avatarPath,
      bio: bio.trim() || null,
      kouize,
      profile_color: account.profileColor,
      stat_colors: account.statColors,
    };
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account) return;
    setSaving(true);
    setMessage("");
    const { error } = await getSupabaseBrowserClient()
      .from("member_public_profiles")
      .upsert(payload()!, { onConflict: "id" });
    setSaving(false);
    setMessage(
      error
        ? "Le profil n’a pas pu être enregistré."
        : "Profil, Kouize et couleurs enregistrés.",
    );
  };
  const uploadAvatar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account) return;
    const file = new FormData(event.currentTarget).get("avatar") as File | null;
    if (!file || file.size === 0) {
      setMessage("Choisis une image pour ton affiche.");
      return;
    }
    if (!avatarTypes.has(file.type) || file.size > 3 * 1024 * 1024) {
      setMessage("Choisis une image JPG, PNG, WebP ou GIF de 3 Mo maximum.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${account.id}/avatar-${Date.now()}.${extension}`;
    setUploading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from("member-avatars")
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) {
      setUploading(false);
      setMessage("L’affiche n’a pas pu être envoyée.");
      return;
    }
    const { error } = await supabase
      .from("member_public_profiles")
      .upsert({ ...payload()!, avatar_path: path }, { onConflict: "id" });
    if (error) {
      await supabase.storage.from("member-avatars").remove([path]);
      setMessage(
        "L’affiche a été envoyée, mais le profil n’a pas pu être mis à jour.",
      );
    } else {
      setAccount({ ...account, avatarPath: path });
      setMessage("Nouvelle affiche enregistrée.");
    }
    setUploading(false);
  };
  if (!configured)
    return (
      <section className="auth-panel">
        <p className="eyebrow">COMPTE</p>
        <h2>Connexion en attente.</h2>
      </section>
    );
  if (loading)
    return (
      <section className="auth-panel">
        <p className="eyebrow">COMPTE</p>
        <h2>Vérification du disque…</h2>
      </section>
    );
  if (!account)
    return (
      <section className="auth-panel">
        <p className="eyebrow">COMPTE</p>
        <h2>Tu n’es pas connecté.</h2>
        <Link className="button" href="/connexion">
          Se connecter
        </Link>
      </section>
    );
  const foreground = isDark(account.profileColor) ? "#F5F1E8" : "#111111";
  const photo = avatarUrl(account.avatarPath);
  return (
    <section className="account-page">
      <section className="member-profile account-member-profile">
        <div className="member-profile__initial member-profile__avatar">
          {photo ? (
            <Image
              src={photo}
              alt={`Affiche de ${account.displayName}`}
              width={220}
              height={220}
            />
          ) : (
            account.displayName.slice(0, 1)
          )}
        </div>
        <div>
          <p className="eyebrow">COMPTE DOL ZIKLUB</p>
          <h1>{account.displayName}</h1>
          <p>
            {account.role === "Administrateur" ? "Membre (admin)" : "Membre"} ·
            @{account.username}
          </p>
        </div>
      </section>
      <form className="avatar-form" onSubmit={uploadAvatar}>
        <label>
          Changer mon affiche
          <input
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            required
          />
        </label>
        <button className="button" type="submit" disabled={uploading}>
          {uploading ? "Envoi…" : "Mettre à jour la photo"}
        </button>
      </form>
      <form
        className="member-kouize account-kouize-editor"
        onSubmit={saveProfile}
        style={{ backgroundColor: account.profileColor, color: foreground }}
      >
        <div>
          <p className="eyebrow">MON KOUIZE</p>
          <h2>
            Ce qui me
            <br />
            <em>fait tendre l’oreille.</em>
          </h2>
          <label className="account-field">
            Mini bio
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={280}
            />
          </label>
          <fieldset className="color-panel stat-color-panel">
            <legend>Couleur de fond de ma fiche</legend>
            <StatColorControl
              label="Couleur de fond"
              value={account.profileColor}
              onChange={updateColor}
            />
          </fieldset>
          <fieldset className="color-panel stat-color-panel">
            <legend>Couleur de mes statistiques</legend>
            <StatColorControl
              label="Toutes mes statistiques"
              value={account.statColors.proposals}
              onChange={updateStatColor}
            />
          </fieldset>
        </div>
        <div className="member-kouize__answers account-kouize-fields">
          <label>
            Ce que j’écoute le plus par défaut
            <select
              value={kouize.default_style}
              onChange={(event) =>
                setKouize({ ...kouize, default_style: event.target.value })
              }
            >
              {styles.map((style) => (
                <option key={style || "empty"} value={style}>
                  {style || "Choisir un style"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ce que je n’aime vraiment pas
            <input
              value={kouize.dislikes}
              onChange={(event) =>
                setKouize({ ...kouize, dislikes: event.target.value })
              }
              maxLength={120}
            />
          </label>
          <label>
            Ce que je suis curieux(se) d’écouter
            <select
              value={kouize.curious_about}
              onChange={(event) =>
                setKouize({ ...kouize, curious_about: event.target.value })
              }
            >
              {styles.map((style) => (
                <option key={style || "empty"} value={style}>
                  {style || "Choisir un style"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ce qui m’attire en premier
            <select
              value={kouize.first_hook}
              onChange={(event) =>
                setKouize({ ...kouize, first_hook: event.target.value })
              }
            >
              {hooks.map((hook) => (
                <option key={hook || "empty"} value={hook}>
                  {hook || "Choisir un élément"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Précision libre
            <textarea
              value={kouize.note}
              onChange={(event) =>
                setKouize({ ...kouize, note: event.target.value })
              }
              maxLength={280}
            />
          </label>
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer ma fiche"}
          </button>
        </div>
      </form>
      {message && (
        <p className="account-message" role="status">
          {message}
        </p>
      )}
      <button
        className="text-link account-signout"
        type="button"
        onClick={async () => {
          await getSupabaseBrowserClient().auth.signOut();
          router.push("/connexion");
          router.refresh();
        }}
      >
        Se déconnecter
      </button>
    </section>
  );
}
