import Link from "next/link";
import Image from "next/image";
import { AlbumCard } from "@/components/album-card";
import { albums, getLatestAlbums } from "@/data/albums";
import { members } from "@/data/members";
import { memes } from "@/data/memes";
import { getClubStats } from "@/lib/statistics";

export default function Home() {
  const stats = getClubStats(albums);
  const latestAlbums = getLatestAlbums(6);

  return <main>
    <section className="hero"><p className="stamp">ARCHIVES PRIVÉES · ÉDITION 01</p><h1>DOL<br/><em>ZIKLUB</em></h1><p className="hero__lede">Chaque semaine, quelqu’un propose un album. Quelqu’un d’autre l’écoute et rend son verdict.</p><div className="hero__actions"><Link className="button" href="/albums">Explorer les archives</Link><Link className="text-link" href="/hasard">Tirer un disque →</Link></div></section>
    <section className="ticker"><span>{albums.length} ALBUMS INDEXÉS</span><span>{stats.rated} VERDICTS RÉPERTORIÉS</span><span>{members.length} PARTICIPANTS IDENTIFIÉS</span></section>
    <section className="section"><div className="section-heading"><div><p className="eyebrow">Les dernières boîtes ouvertes</p><h2>Archives les plus récentes</h2></div><Link href="/albums">Tout voir →</Link></div><div className="album-grid">{latestAlbums.map((album) => <AlbumCard key={album.id} album={album} />)}</div></section>
    <section className="split-section"><div><p className="eyebrow">Le club en chiffres</p><h2>Des données, pas du blabla.</h2><div className="stat-row"><b>{stats.total}</b><span>albums indexés</span></div><div className="stat-row"><b>{stats.rated}</b><span>verdicts enregistrés</span></div><p className="note">Les fiches sont maintenant alimentées par l’archive historique : proposition, écoute, note, avis et morceaux lorsque ces informations existent.</p></div><div className="member-wall">{members.map((member, index) => <Link href={`/membres/${member.slug}`} key={member.slug} className="member-chip"><span>{String(index + 1).padStart(2, "0")}</span>{member.displayName}</Link>)}</div></section>
    <section className="section meme-preview"><div className="section-heading"><div><p className="eyebrow">Musée des dossiers</p><h2>Mèmes du Ziklub</h2></div><Link href="/memes">Ouvrir les archives →</Link></div><div className="meme-strip">{memes.slice(0, 4).map((meme) => <Image src={meme.src} alt={meme.alt} key={meme.id} width={500} height={500} sizes="(max-width: 700px) 45vw, 25vw" />)}</div></section>
  </main>;
}
