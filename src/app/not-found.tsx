import Link from "next/link";
export default function NotFound() { return <main className="page empty-state"><b>Cette archive a disparu entre deux bacs.</b><p>La fiche demandée n’existe pas ou n’a pas encore été indexée.</p><Link className="button" href="/albums">Retour aux albums</Link></main>; }
