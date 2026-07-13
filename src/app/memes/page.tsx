import { MemeGallery } from "@/components/meme-gallery";
import { memes } from "@/data/memes";
export default function MemesPage() { return <main className="page"><p className="eyebrow">MUSÉE DES DOSSIERS</p><h1>Même section</h1><MemeGallery memes={memes} /></main>; }
