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
    id: "wheely-slide-jump-cancel",
    version: "2.2",
    date: "2026-07-26",
    title: "La glissade de Wheely devient annulable",
    summary: "Un saut peut maintenant interrompre une roulade apr\u00e8s un court d\u00e9lai de protection de 0,1 seconde.",
    categories: ["Correction", "Am\u00e9lioration"],
    added: [],
    fixed: [
      { text: "Pendant une glissade, la commande de saut rel\u00e8ve maintenant Wheely et d\u00e9clenche imm\u00e9diatement un saut normal." },
      { text: "Les 100 premi\u00e8res millisecondes de la roulade restent prot\u00e9g\u00e9es pour \u00e9viter une annulation instantan\u00e9e de l\u2019animation." },
    ],
    improved: [
      { text: "Les commandes sont plus coh\u00e9rentes : la glissade acc\u00e9l\u00e8re d\u00e9j\u00e0 la descente d\u2019un saut, et le saut peut d\u00e9sormais sortir d\u2019une glissade." },
    ],
    links: [
      { label: "Jouer \u00e0 Wheely", href: "/" },
    ],
  },
  {
    id: "draw-deadline-timer-reminders",
    version: "2.1",
    date: "2026-07-26",
    title: "Un chrono de sept jours pour chaque tirage",
    summary: "Le tirage en cours affiche maintenant son temps restant en heure de Paris et rappelle automatiquement les actions encore manquantes.",
    categories: ["Nouvelle fonctionnalit\u00e9", "Am\u00e9lioration", "Tirages"],
    added: [
      { text: "Un compte \u00e0 rebours en temps r\u00e9el d\u00e9marre \u00e0 la cr\u00e9ation du tirage et mesure exactement sept jours." },
      { text: "\u00c0 mi-parcours, chaque proposeur sans album re\u00e7oit un rappel dans la cloche du site." },
      { text: "Lorsqu\u2019il reste moins de 24 heures, chaque auditeur sans avis re\u00e7oit un dernier rappel." },
    ],
    fixed: [],
    improved: [
      { text: "L\u2019\u00e9ch\u00e9ance est affich\u00e9e en heure de Paris sur ordinateur, tablette et mobile." },
      { text: "\u00c0 la fin des sept jours, le compteur reste \u00e0 z\u00e9ro sans bloquer le site ; le prochain tirage publi\u00e9 affiche automatiquement son propre chrono." },
    ],
    links: [
      { label: "Voir le tirage en cours", href: "/tableur" },
    ],
  },
  {
    id: "bonus-catalog-manual-deezer",
    version: "2.0",
    date: "2026-07-26",
    title: "Toutes les \u00e9coutes bonus, Deezer uniquement sur demande",
    summary: "Chaque album renseign\u00e9 dans un tirage devient imm\u00e9diatement disponible en \u00e9coute bonus et la recherche Deezer attend maintenant un clic explicite.",
    categories: ["Correction", "Am\u00e9lioration", "Albums", "Tirages", "\u00c9coutes bonus"],
    added: [],
    fixed: [
      { text: "Les albums sans note, sans avis ou encore en attente apparaissent d\u00e9sormais dans les \u00e9coutes bonus d\u00e8s qu\u2019ils sont renseign\u00e9s dans un tirage." },
      { text: "Les anciens tirages, le tirage en cours et les prochains tirages utilisent la m\u00eame source dynamique, sans cr\u00e9er de faux avis." },
      { text: "La recherche Deezer d\u2019albums ne se lance plus pendant la saisie et part une seule fois apr\u00e8s un clic sur \u00ab RECHERCHER SUR DEEZER \u00bb." },
    ],
    improved: [
      { text: "Deezer affiche jusqu\u2019\u00e0 cinq albums probables, class\u00e9s selon le titre, l\u2019artiste, la proximit\u00e9 textuelle, la popularit\u00e9 et l\u2019ordre du catalogue." },
      { text: "Chaque r\u00e9sultat conserve sa pochette, son lien Deezer et son identifiant catalogue jusqu\u2019\u00e0 la confirmation manuelle." },
    ],
    links: [
      { label: "Ouvrir les \u00e9coutes bonus", href: "/tableur" },
      { label: "Modifier mes albums favoris", href: "/compte" },
    ],
  },
  {
    id: "wheely-reset-theme-refinements",
    version: "1.9",
    date: "2026-07-26",
    title: "Wheely repart de z\u00e9ro, les nouveaux profils s\u2019affinent",
    summary: "Le d\u00e9blocage Wheely est r\u00e9initialis\u00e9 pour tout le club et les quatre nouveaux univers de profil gagnent en pr\u00e9cision visuelle.",
    categories: ["Correction", "Am\u00e9lioration", "Profil"],
    added: [],
    fixed: [
      { text: "Le th\u00e8me Wheely est \u00e0 nouveau verrouill\u00e9 pour tous les membres, y compris les anciens gagnants. Il se d\u00e9bloque uniquement apr\u00e8s avoir termin\u00e9 le mini-jeu." },
      { text: "Les images de Noir Cin\u00e9ma et la photo de profil de Manga Panel conservent d\u00e9sormais leurs couleurs d\u2019origine." },
      { text: "Les boutons \u00ab Voir le profil \u00bb de Punk Poster, Jazz Lounge et Acid Rave retrouvent la m\u00eame taille que les autres th\u00e8mes." },
      { text: "Les cadres du profil et des notes sont d\u00e9sormais ferm\u00e9s dans Museum White." },
    ],
    improved: [
      { text: "Le d\u00e9grad\u00e9 de Cassette Sunset passe plus naturellement du ciel violet \u00e0 l\u2019horizon chaud." },
      { text: "Les contours sobres de Museum White restent lisibles sur ordinateur comme sur mobile." },
    ],
    links: [
      { label: "Choisir un th\u00e8me", href: "/compte" },
      { label: "Lancer Wheely", href: "/" },
      { label: "Voir les profils", href: "/membres" },
    ],
  },
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
