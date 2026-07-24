import { RandomAlbum } from "@/components/random-album";
import { albums } from "@/data/albums";
import { getSynchronizedAlbums } from "@/lib/live-albums";

export const dynamic = "force-dynamic";

export default async function RandomPage() {
  const catalog = await getSynchronizedAlbums().catch(() => albums);
  return <main className="page random-page"><p className="eyebrow">TIRAGE DU BAC</p><h1>Laisse le hasard<br/><em>choisir ton disque.</em></h1><RandomAlbum albums={catalog} /></main>;
}