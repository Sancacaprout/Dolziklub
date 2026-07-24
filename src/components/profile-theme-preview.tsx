import { WheelyThemeArt } from "@/components/wheely-theme-art";
import { profileThemes, type ProfileThemeId } from "@/lib/profile-themes";

type ProfileThemePreviewProps = {
  theme: ProfileThemeId;
  displayName: string;
  username: string;
  role: "admin" | "member";
};

export function ProfileThemePreview({
  theme,
  displayName,
  username,
  role,
}: ProfileThemePreviewProps) {
  const item = profileThemes.find((entry) => entry.id === theme)!;
  const initial = displayName.trim().slice(0, 1).toUpperCase() || "M";
  const isWheely = item.id === "wheely" && item.previewVariant === "wheely";

  return (
    <aside className="profile-theme-preview profile-theme" data-profile-theme={theme} aria-label={`Aperçu du thème ${item.name}`}>
      <p className="eyebrow">{isWheely ? "PROFILE SELECTED · WHEELY RIDER" : <>APERÇU EN DIRECT · {item.name}</>}</p>
      {isWheely ? <WheelyThemeArt variant="preview" /> : null}
      <div className="profile-theme-preview__head">
        <span className="profile-theme-preview__avatar">{initial}</span>
        <div><b>{displayName}</b><small>@{username} · {role === "admin" ? "Membre (admin)" : "Membre"}</small></div>
      </div>
      <div className="profile-theme-preview__quiz"><span>{isWheely ? "MISSION MUSICALE" : "KOUIZE"}</span><b>Ce qui fait tendre l’oreille.</b><small>La mélodie, toujours.</small></div>
      <div className="profile-theme-preview__stats"><b>12</b><span>{isWheely ? "SCORE · écoutes" : "écoutes"}</span></div>
      <div className="profile-theme-preview__albums"><span /><span /><span /></div>
      <button type="button" className="profile-theme-preview__button">{isWheely ? "READY →" : "Un bouton"}</button>
    </aside>
  );
}