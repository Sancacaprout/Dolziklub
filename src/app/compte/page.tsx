import { AccountPanel } from "@/components/auth/account-panel";
import { ProfilePersonalization } from "@/components/auth/profile-personalization";

export const metadata = { title: "Mon compte — DOL ZIKLUB" };

export default function AccountPage() {
  return <main className="page auth-page"><AccountPanel /><ProfilePersonalization /></main>;
}
