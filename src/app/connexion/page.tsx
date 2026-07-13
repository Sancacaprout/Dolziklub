import { LoginPanel } from "@/components/auth/login-panel";

export const metadata = { title: "Connexion — DOL ZIKLUB" };

export default function LoginPage() {
  return <main className="page auth-page"><p className="eyebrow">IDENTIFIANTS DU CLUB</p><h1>La porte du<br/><em>Dol Ziklub.</em></h1><LoginPanel /></main>;
}
