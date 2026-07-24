export const updateCategories = [
  "Nouvelle fonctionnalité",
  "Correction",
  "Amélioration",
  "Profil",
  "Albums",
  "Tirages",
  "Écoutes bonus",
  "Mèmes",
  "Statistiques",
  "Administration",
] as const;

export type UpdateCategory = (typeof updateCategories)[number];
export type UpdateKind = "added" | "fixed" | "improved";

export type UpdateChange = {
  text: string;
  href?: `/${string}`;
  linkLabel?: string;
};

export type UpdateLink = {
  label: string;
  href: `/${string}`;
};

export type SiteUpdate = {
  id: string;
  version?: string;
  date: `${number}-${number}-${number}`;
  title: string;
  summary?: string;
  categories: readonly UpdateCategory[];
  added: readonly UpdateChange[];
  fixed: readonly UpdateChange[];
  improved: readonly UpdateChange[];
  links: readonly UpdateLink[];
};

export const siteUpdates = [
  {
    id: "profiles-bonus-wheely",
    version: "1.8",
    date: "2026-07-24",
    title: "Les profils prennent une nouvelle dimension",
    summary: "Davantage de personnalité, des écoutes bonus mieux intégrées et un univers Wheely complet.",
    categories: ["Nouvelle fonctionnalité", "Profil", "Écoutes bonus"],
    added: [
      { text: "Ajout du thème de profil Wheely, inspiré du mini-jeu et de ses véritables assets.", href: "/compte", linkLabel: "Choisir un thème" },
      { text: "Les profils peuvent présenter leurs artistes, morceaux et clip préférés.", href: "/membres", linkLabel: "Voir les profils" },
      { text: "Les écoutes bonus disposent d’un espace dédié sans modifier les moyennes officielles.", href: "/tableur", linkLabel: "Ouvrir le tableur" },
    ],
    fixed: [
      { text: "Les profils et leurs sections musicales se chargent de manière plus fiable." },
      { text: "Les avis bonus restent accessibles pour être relus ou modifiés." },
    ],
    improved: [
      { text: "La personnalisation du profil bénéficie d’aperçus complets et isolés entre les thèmes." },
      { text: "Les écoutes bonus sont visibles dans le tableur et sur les profils concernés." },
    ],
    links: [
      { label: "Modifier mon profil", href: "/compte" },
      { label: "Voir les tirages", href: "/tableur" },
    ],
  },
  {
    id: "draws-deezer-rankings",
    version: "1.7",
    date: "2026-07-18",
    title: "Tirages plus vivants, musique plus accessible",
    summary: "Les tirages gagnent en souplesse et l’écoute des morceaux devient plus directe dans tout le club.",
    categories: ["Nouvelle fonctionnalité", "Tirages", "Albums", "Statistiques"],
    added: [
      { text: "Ajout des tirages globaux avec une roue animée pour désigner la personne qui propose l’album.", href: "/tableur", linkLabel: "Voir les tirages" },
      { text: "Génération aléatoire des duos de tirage classique en évitant les associations déjà utilisées dans le même sens." },
      { text: "Le lecteur Deezer permet de régler le volume des extraits directement dans le site." },
    ],
    fixed: [
      { text: "Les duos générés automatiquement peuvent de nouveau être modifiés avant publication." },
      { text: "Les anciens verdicts en attente retrouvent correctement leur album et leur auditeur." },
      { text: "Les liens Best Track et Worst Track restent interactifs sur les fiches et les tirages." },
    ],
    improved: [
      { text: "Les albums du tirage actif et les archives sont mieux synchronisés dans le catalogue.", href: "/albums", linkLabel: "Ouvrir les albums" },
      { text: "Le classement affiche les styles musicaux les plus représentés et les albums associés.", href: "/classements", linkLabel: "Voir les classements" },
    ],
    links: [
      { label: "Voir les tirages", href: "/tableur" },
      { label: "Explorer les albums", href: "/albums" },
      { label: "Consulter les statistiques", href: "/classements" },
    ],
  },
  {
    id: "wheely-safari-launch",
    version: "1.6",
    date: "2026-07-16",
    title: "Wheely démarre sa course",
    summary: "Le mini-jeu du vinyle arrive sur l’accueil avec une transition dédiée et une meilleure compatibilité navigateur.",
    categories: ["Nouvelle fonctionnalité", "Amélioration", "Albums"],
    added: [
      { text: "Le vinyle de l’accueil lance désormais le mini-jeu Wheely.", href: "/", linkLabel: "Aller à l’accueil" },
      { text: "Ajout d’une transition de chargement dédiée avant l’entrée dans le jeu." },
    ],
    fixed: [
      { text: "Correction de plusieurs restrictions audio et de stockage rencontrées sur Safari." },
      { text: "Les icônes du site et les liens musicaux restent utilisables sur les appareils Apple." },
    ],
    improved: [
      { text: "Le mini-jeu vise un rendu stable à 60 images par seconde." },
      { text: "Les obstacles disparaissent plus rapidement après avoir franchi la zone de jeu." },
    ],
    links: [
      { label: "Lancer depuis l’accueil", href: "/" },
      { label: "Découvrir le concept", href: "/concept" },
    ],
  },
] as const satisfies readonly SiteUpdate[];
