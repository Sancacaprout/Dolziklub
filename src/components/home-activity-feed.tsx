import Link from "next/link";
import type { HomeActivity } from "@/lib/home-activity";

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 2) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

const labels = { proposal: "PROPOSITION", verdict: "VERDICT", meme: "MÈME", draw: "TIRAGE" } as const;
const symbols = { proposal: "↳", verdict: "★", meme: "☺", draw: "◎" } as const;

export function HomeActivityFeed({ activity }: { activity: HomeActivity[] }) {
  return <section className="home-activity" aria-labelledby="activity-title"><div className="home-activity__heading"><div><p className="eyebrow">ÇA BOUGE AU CLUB</p><h2 id="activity-title">Fil d’activité</h2></div><Link href="/tableur">Voir le tirage →</Link></div>{activity.length ? <ol className="activity-list">{activity.map((item) => <li className={`activity-item activity-item--${item.kind}`} key={item.id}><span className="activity-item__symbol" aria-hidden="true">{symbols[item.kind]}</span><div><span className="activity-item__type">{labels[item.kind]}</span><Link href={item.href}><b>{item.title}</b><p>{item.detail}</p></Link></div><time dateTime={item.occurredAt}>{relativeTime(item.occurredAt)}</time></li>)}</ol> : <div className="activity-empty"><b>Le fil attend le prochain mouvement.</b><p>Une proposition, un verdict, un mème ou un nouveau tirage apparaîtra ici.</p></div>}</section>;
}
