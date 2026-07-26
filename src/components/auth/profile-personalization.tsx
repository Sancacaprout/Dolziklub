"use client";

import { WheelyThemeArt } from "@/components/wheely-theme-art";

import { useEffect, useRef, useState } from "react";
import {
  defaultProfileTheme,
  profileThemes,
  type ProfileThemeId,
} from "@/lib/profile-themes";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

type Account = {
  id: string;
  username: string;
  displayName: string;
};

export function ProfilePersonalization() {
  const configured = isSupabaseConfigured();
  const [account, setAccount] = useState<Account | null>(null);
  const [savedTheme, setSavedTheme] = useState<ProfileThemeId>(defaultProfileTheme);
  const [draftTheme, setDraftTheme] = useState<ProfileThemeId>(defaultProfileTheme);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<ProfileThemeId | null>(null);
  const [wheelyUnlocked, setWheelyUnlocked] = useState(false);
  const [unlockReady, setUnlockReady] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!configured) return;

    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data: profile } = await supabase
        .from("member_public_profiles")
        .select("profile_theme,username")
        .eq("id", auth.user.id)
        .maybeSingle();

      const { data: achievement } = await supabase
        .from("participant_achievements")
        .select("achievement_key")
        .eq("participant_id", auth.user.id)
        .eq("achievement_key", "wheely-theme")
        .maybeSingle();

      const requestedTheme = profile?.profile_theme as ProfileThemeId | undefined;
      const theme = profileThemes.some((item) => item.id === requestedTheme)
        && requestedTheme !== "wheely"
        ? requestedTheme!
        : defaultProfileTheme;
      const username =
        typeof profile?.username === "string" && profile.username.trim()
          ? profile.username
          : typeof auth.user.app_metadata.username === "string" &&
              auth.user.app_metadata.username.trim()
            ? auth.user.app_metadata.username
            : "membre";
      const displayName =
        typeof auth.user.app_metadata.display_name === "string" &&
        auth.user.app_metadata.display_name.trim()
          ? auth.user.app_metadata.display_name
          : username;

      setWheelyUnlocked(Boolean(achievement));
      setUnlockReady(true);
      setSavedTheme(theme);
      setDraftTheme(theme);
      setAccount({ id: auth.user.id, username, displayName });
    };

    void load();
  }, [configured]);

  useEffect(() => {
    const handleUnlock = () => {
      setWheelyUnlocked(true);
      setUnlockReady(true);
      setMessage("THÈME WHEELY DÉBLOQUÉ — tu peux maintenant le sélectionner.");
    };
    window.addEventListener("wheely-theme-unlocked", handleUnlock);
    return () => window.removeEventListener("wheely-theme-unlocked", handleUnlock);
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      "profile-theme-page",
      savedTheme !== defaultProfileTheme,
    );
    if (savedTheme === defaultProfileTheme) {
      delete document.body.dataset.profileTheme;
    } else {
      document.body.dataset.profileTheme = savedTheme;
    }
    return () => {
      document.body.classList.remove("profile-theme-page");
      delete document.body.dataset.profileTheme;
    };
  }, [savedTheme]);

  useEffect(() => {
    if (!previewTheme) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const section = sectionRef.current;
    const backgroundElements = section
      ? Array.from(section.children).filter(
          (element) => !(element instanceof HTMLElement && element.dataset.themeDialog === "true"),
        )
      : [];

    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => element.setAttribute("inert", ""));
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPreviewTheme(null);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), iframe, a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element) => element.removeAttribute("inert"));
      previousFocus?.focus();
    };
  }, [previewTheme]);

  const saveTheme = async () => {
    if (!account || saving || draftTheme === savedTheme) return;
    if (draftTheme === "wheely" && !wheelyUnlocked) {
      setMessage("Termine le mini-jeu Wheely avant d’équiper ce thème.");
      return;
    }
    setSaving(true);
    setMessage("");

    const { data, error } = await getSupabaseBrowserClient().rpc(
      "save_my_profile_theme",
      { p_theme: draftTheme },
    );

    if (error || !data) {
      setMessage(
        error?.message?.includes("Wheely")
          ? "Termine le mini-jeu Wheely avant d’équiper ce thème."
          : "Le thème n’a pas pu être enregistré. Réessaie dans un instant.",
      );
      setSaving(false);
      return;
    }

    setSavedTheme(draftTheme);
    setMessage("Thème enregistré et publié sur ton profil.");
    setSaving(false);
  };

  if (!configured || !account) return null;

  const wheelyLocked = !unlockReady || !wheelyUnlocked;
  const previewName =
    profileThemes.find((theme) => theme.id === previewTheme)?.name ?? "";

  return (
    <section
      ref={sectionRef}
      className="profile-personalization profile-settings-panel profile-theme"
      data-profile-theme={draftTheme}
    >
      <header>
        <p className="eyebrow">PERSONNALISATION</p>
        <h2>Ma fiche, à mon image.</h2>
        <p>
          Choisis un thème, prévisualise ton vrai profil, puis enregistre-le
          lorsqu’il te convient.
        </p>
      </header>

      <div className="profile-personalization__layout">
        <fieldset className="theme-picker">
          <legend>Thème de profil</legend>
          <div className="theme-picker__grid">
            {profileThemes.map((theme) => (
              <article
                key={theme.id}
                className={`theme-card profile-theme${
                  draftTheme === theme.id ? " is-selected" : ""
                }${theme.id === "wheely" && wheelyLocked ? " is-locked" : ""}`}
                data-theme-locked={theme.id === "wheely" && wheelyLocked ? "true" : undefined}
                data-profile-theme={theme.id}
                data-preview-motif={theme.previewMotif ?? "classic"}
              >
                <button
                  type="button"
                  className="theme-card__choice"
                  onClick={() => {
                    if (theme.id === "wheely" && wheelyLocked) return;
                    setDraftTheme(theme.id);
                    setMessage("");
                  }}
                  aria-pressed={draftTheme === theme.id}
                  disabled={theme.id === "wheely" && wheelyLocked}
                >
                  <span className="theme-card__mini" aria-hidden="true">
                    {theme.id === "wheely" && theme.previewVariant === "wheely" ? (
                      <WheelyThemeArt variant="card" />
                    ) : null}
                    <i>{account.displayName.slice(0, 1).toUpperCase()}</i>
                    <span>
                      <b>{account.displayName}</b>
                      <small>@{account.username}</small>
                    </span>
                    <em />
                    <strong>12</strong>
                    <u />
                  </span>
                  <span className="theme-card__colors">
                    {theme.previewColors.map((color) => (
                      <i key={color} style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <b>{theme.name}</b>
                  <small>{theme.description}</small>
                  {theme.id === "wheely" ? (
                    <span className={`theme-card__unlock theme-card__unlock--${wheelyLocked ? "locked" : "ready"}`}>
                      {wheelyLocked ? "🔒 VERROUILLÉ" : "✓ DÉBLOQUÉ"}
                    </span>
                  ) : null}
                  {theme.id === "wheely" && wheelyLocked ? (
                    <small className="theme-card__unlock-help">Termine le mini-jeu Wheely pour débloquer ce thème.</small>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="theme-card__preview"
                  onClick={() => setPreviewTheme(theme.id)}
                >
                  Voir le profil
                </button>
              </article>
            ))}
          </div>

          <div className="theme-picker__actions">
            <button
              type="button"
              className="button"
              onClick={() => void saveTheme()}
              disabled={saving || draftTheme === savedTheme || (draftTheme === "wheely" && wheelyLocked)}
            >
              {saving ? "Enregistrement…" : "Enregistrer mon thème"}
            </button>
          </div>
        </fieldset>

        {message ? (
          <p className="account-message" role="status">
            {message}
          </p>
        ) : null}
      </div>

      {previewTheme ? (
        <div
          ref={dialogRef}
          className="theme-preview-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="theme-preview-title"
          data-theme-dialog="true"
        >
          <div className="theme-preview-dialog__panel">
            <div className="theme-preview-dialog__header">
              <div>
                <p className="eyebrow">{previewTheme === "wheely" && wheelyLocked ? "APERÇU — THÈME VERROUILLÉ" : "APERÇU DU THÈME"}</p>
                <h3 id="theme-preview-title">{previewName}</h3>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="theme-preview-dialog__close"
                onClick={() => setPreviewTheme(null)}
              >
                Fermer
              </button>
            </div>
            <iframe
              className="theme-preview-dialog__frame"
              title={`Profil public avec le thème ${previewName}`}
              src={`/membres/${encodeURIComponent(account.username)}?previewTheme=${previewTheme}&profilePreview=1${previewTheme === "wheely" && wheelyLocked ? "&themeLocked=1" : ""}`}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
