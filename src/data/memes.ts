import manifest from "./manifest_memes.json";
import type { Meme } from "@/types/meme";

type ManifestEntry = { nouveau_nom: string };

const requestedOrder = [
  "Starter pack des albums de Toma",
  "Pep après avoir mis 2 sur 5 à A Tribe Called Quest",
  "Alain quand il doit écouter l'album de Dod",
  "Alain dit qu'il participe puis disparaît",
  "Attendre les gars pour écouter leurs albums",
  "Comment Alain s'imaginait après avoir écouté l'album",
  "POV les propositions de Yuna - Tour japonaise de 1000 mètres",
];

const orderByTitle = new Map(requestedOrder.map((title, index) => [title, index]));

export const memes: Meme[] = (manifest as ManifestEntry[])
  .map((entry, index) => ({
    id: `meme-${index + 1}`,
    title: entry.nouveau_nom.replace(/\.(png|jpg)$/i, ""),
    src: `/memes/${entry.nouveau_nom}`,
    alt: entry.nouveau_nom.replace(/\.(png|jpg)$/i, ""),
  }))
  .filter((meme) => !/a lik(?:é|er) ce m[êe]me/i.test(meme.title))
  .sort((a, b) => (orderByTitle.get(a.title) ?? 99) - (orderByTitle.get(b.title) ?? 99));
