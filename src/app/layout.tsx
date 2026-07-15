import type { Metadata } from "next";
import { DM_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { NotificationBell } from "@/components/notification-bell";
import { MusicPlayerProvider } from "@/components/music-player";
import { SiteHeader } from "@/components/site-header";

const display = Space_Grotesk({ variable: "--font-display", subsets: ["latin"] });
const mono = DM_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });
export const metadata: Metadata = { title: "DOL ZIKLUB — Archives musicales", description: "Le club privé où l’on impose des albums et où l’on rend des comptes.", metadataBase: new URL("https://dolziklub.vercel.app") };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr" className={`${display.variable} ${mono.variable}`}><body><MusicPlayerProvider><SiteHeader />{children}<Footer /><NotificationBell /></MusicPlayerProvider></body></html>; }
