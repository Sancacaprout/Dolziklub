import type { ReactNode } from "react";

type LegalPageProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function LegalPage({ eyebrow, title, children }: LegalPageProps) {
  return <main className="page legal-page"><header className="legal-page__header"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="page-lede">Dernière mise à jour : 14 juillet 2026.</p></header><div className="legal-page__content">{children}</div></main>;
}