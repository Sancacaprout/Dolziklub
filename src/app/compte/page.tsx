import { AccountPanel } from "@/components/auth/account-panel";
import { AccountSignOut } from "@/components/auth/account-signout";
import { ProfilePersonalization } from "@/components/auth/profile-personalization";
import { isProfileCustomThemeEditorEnabled } from "@/lib/profile-custom-theme/feature-flag";

export const metadata = { title: "Mon compte — DOL ZIKLUB" };

export default function AccountPage() {
  const customThemeEnabled = isProfileCustomThemeEditorEnabled();
  return (
    <main className="page auth-page">
      <AccountPanel />
      <ProfilePersonalization customThemeEnabled={customThemeEnabled} />
      <AccountSignOut />
    </main>
  );
}
