import { RandomAlbum } from "@/components/random-album";
import { albums } from "@/data/albums";
export default function RandomPage() { return <main className="page random-page"><p className="eyebrow">TIRAGE DU BAC</p><h1>Laisse le hasard<br/><em>choisir ton disque.</em></h1><RandomAlbum albums={albums} /></main>; }
