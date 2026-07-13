import { MemeGallery } from "@/components/meme-gallery";
import { memes } from "@/data/memes";
export default function MemesPage() { return <main className="page"><p className="eyebrow">MUSÉE DES DOSSIERS</p><h1>Les preuves<br/><em>compromettantes.</em></h1><p className="page-lede">15 pièces soigneusement classées. Toute ressemblance avec des membres du club est évidemment assumée.</p><MemeGallery memes={memes} /></main>; }
