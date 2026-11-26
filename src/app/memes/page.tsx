import { MemeGallery } from "@/components/meme-gallery";
import { memes } from "@/data/memes";
export default async function MemesPage({ searchParams }: { searchParams: Promise<{ meme?: string; comments?: string }> }) {
  const { meme, comments } = await searchParams;
  return <main className="page"><p className="eyebrow">MUSÉE DES DOSSIERS</p><h1>Mème section</h1><MemeGallery key={meme} memes={memes} initialId={meme} openComments={comments === "1"} /></main>;
}
