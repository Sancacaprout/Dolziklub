import manifest from "./manifest_memes.json";
import type { Meme } from "@/types/meme";

type ManifestEntry = { nouveau_nom: string };

export const memes: Meme[] = (manifest as ManifestEntry[]).map((entry, index) => ({
  id: `meme-${index + 1}`,
  title: entry.nouveau_nom.replace(/\.(png|jpg)$/i, ""),
  src: `/memes/${entry.nouveau_nom}`,
  alt: entry.nouveau_nom.replace(/\.(png|jpg)$/i, ""),
}));
