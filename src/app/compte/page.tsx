import { AccountPanel } from "@/components/auth/account-panel";
import { AccountSignOut } from "@/components/auth/account-signout";
import { ProfilePersonalization } from "@/components/auth/profile-personalization";

export const metadata = { title: "Mon compte — DOL ZIKLUB" };

export default function AccountPage() {
  return (
    <main className="page auth-page">
      <AccountPanel />
      <ProfilePersonalization />
      <AccountSignOut />
    </main>
  );
}
