"use client";

import Link from "next/link";
import { useState } from "react";
import type { SiteUpdate, UpdateChange, UpdateKind } from "@/data/site-updates";

type UpdateFilter = "all" | UpdateKind;

const filters: readonly { id: UpdateFilter; label: string }[] = [
  { id: "all", label: "\u{1F4DA} Tout" },
  { id: "added", label: "\u{2728} Nouveautés" },
  { id: "fixed", label: "\u{1F6E0}\u{FE0F} Corrections" },
  { id: "improved", label: "\u{1F680} Améliorations" },
];

const sectionLabels: Record<UpdateKind, string> = {
  added: "\u{2728} Nouveautés",
  fixed: "\u{1F6E0}\u{FE0F} Corrections",
  improved: "\u{1F680} Améliorations",
};

function formatDate(date: SiteUpdate["date"]) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function UpdateSection({ kind, changes }: { kind: UpdateKind; changes: readonly UpdateChange[] }) {
  if (!changes.length) return null;
  return (
    <section className={`update-card__section update-card__section--${kind}`}>
      <h3>{sectionLabels[kind]}</h3>
      <ul>
        {changes.map((change) => (
          <li key={change.text}>
            <span>{change.text}</span>
            {change.href && change.linkLabel ? <Link href={change.href}>{change.linkLabel} <span aria-hidden="true">→</span></Link> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UpdatesBoard({ updates }: { updates: readonly SiteUpdate[] }) {
  const [filter, setFilter] = useState<UpdateFilter>("all");
  const visibleUpdates = filter === "all" ? updates : updates.filter((update) => update[filter].length > 0);

  return (
    <>
      <nav className="updates-filter" aria-label="Filtrer les mises à jour">
        <span>Afficher</span>
        <div>
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <p className="updates-result-count" role="status" aria-live="polite">
        {visibleUpdates.length} version{visibleUpdates.length > 1 ? "s" : ""} affichée{visibleUpdates.length > 1 ? "s" : ""}
      </p>

      <div className="updates-timeline">
        {visibleUpdates.map((update) => (
          <article className="update-card" id={update.id} key={update.id}>
            <header className="update-card__meta">
              {update.version ? <span>VERSION {update.version}</span> : null}
              <time dateTime={update.date}>{formatDate(update.date)}</time>
            </header>
            <div className="update-card__content">
              <div className="update-card__heading">
                <div>
                  <div className="update-card__badges" aria-label="Catégories">
                    {update.categories.map((category) => <span key={category}>{category}</span>)}
                  </div>
                  <h2>{update.title}</h2>
                  {update.summary ? <p>{update.summary}</p> : null}
                </div>
                <a href={`#${update.id}`} aria-label={`Lien direct vers ${update.title}`}>#</a>
              </div>

              <div className="update-card__changes">
                <UpdateSection kind="added" changes={update.added} />
                <UpdateSection kind="fixed" changes={update.fixed} />
                <UpdateSection kind="improved" changes={update.improved} />
              </div>

              {update.links.length ? (
                <nav className="update-card__links" aria-label={`Pages liées à la version ${update.version ?? update.title}`}>
                  {update.links.map((link) => <Link href={link.href} key={link.href}>{link.label} <span aria-hidden="true">↗</span></Link>)}
                </nav>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
