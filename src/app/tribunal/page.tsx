import type { Metadata } from "next";
import { TribunalBoard } from "@/components/tribunal-board";

export const metadata: Metadata = {
  title: "Le Tribunal — DOL ZIKLUB",
  description: "16 questions anonymes pour régler les comptes musicaux du club.",
};

export default function TribunalPage() {
  return <main><TribunalBoard /></main>;
}
