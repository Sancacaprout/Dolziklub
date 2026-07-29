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
    id: "tribunal-one-joker",
    version: "2.13",
    date: "2026-07-29",
    title: "Un joker entre au Tribunal",
    summary: "Chaque membre peut désormais passer une seule question par édition grâce à un joker personnel.",
    categories: ["Nouvelle fonctionnalité", "Amélioration"],
    added: [
      { text: "Le bouton « Utiliser mon joker » permet de classer une question sans y répondre." },
      { text: "Chaque membre ne dispose que d’un seul joker par édition, même en cas de double clic ou de plusieurs onglets." },
    ],
    fixed: [],
    improved: [
      { text: "La question passée compte dans la progression mais le joker est exclu des votes, pourcentages et classements." },
    ],
    links: [
      { label: "Entrer au Tribunal", href: "/tribunal" },
    ],
  },

  {
    id: "tribunal-validation-stamp-duration",
    version: "2.12",
    date: "2026-07-29",
    title: "Le verdict du Tribunal reste un peu plus longtemps",
    summary: "Le tampon affiché après chaque réponse reste désormais assez longtemps à l’écran pour que son message soit parfaitement lisible.",
    categories: ["Amélioration"],
    added: [],
    fixed: [],
    improved: [
      { text: "Le message de validation reste visible pendant 1,2 seconde avant l’arrivée de la question suivante." },
      { text: "L’apparition du tampon est légèrement plus douce, tout en respectant la préférence de réduction des animations." },
    ],
    links: [
      { label: "Entrer au Tribunal", href: "/tribunal" },
    ],
  },

  {
    id: "le-tribunal",
    version: "2.11",
    date: "2026-07-29",
    title: "Le Tribunal ouvre les dossiers du club",
    summary: "Le Tribunal est ouvert : réponds à 16 questions anonymes sur les goûts, les notes et les propositions du club, puis découvre les résultats à la fin de l’édition.",
    categories: ["Nouvelle fonctionnalité", "Amélioration", "Albums", "Administration"],
    added: [
      { text: "Une nouvelle page permet aux membres connectés de répondre anonymement à 16 questions sur le club, une question à la fois." },
      { text: "Les questions s’appuient sur les vrais membres, albums proposés et avis du tableur, sans créer de doublons de données." },
      { text: "Les résultats révélés affichent le podium, les votes, les pourcentages et les réponses libres sans dévoiler les votants." },
    ],
    fixed: [],
    improved: [
      { text: "Les administrateurs peuvent préparer une édition, l’ouvrir, la fermer, révéler ses résultats et masquer une réponse libre sans la supprimer." },
      { text: "Chaque réponse est enregistrée immédiatement et peut être reprise ou modifiée tant que l’édition reste ouverte." },
    ],
    links: [
      { label: "Entrer au Tribunal", href: "/tribunal" },
    ],
  },

  {
    id: "bonus-reviews-responsive-layout",
    version: "2.10",
    date: "2026-07-29",
    title: "Les écoutes bonus retrouvent toute leur largeur",
    summary: "Les avis bonus restent maintenant lisibles dans les cellules étroites du tableur, notamment sur mobile.",
    categories: ["Correction", "Albums", "Tirages", "Écoutes bonus"],
    added: [],
    fixed: [
      { text: "Le titre de l’avis, son texte et le lien « Lire l’avis complet » s’affichent de nouveau verticalement au lieu d’être comprimés en colonnes." },
      { text: "Les blocs d’écoutes bonus peuvent désormais rétrécir jusqu’à la largeur disponible sans provoquer de débordement sur mobile." },
    ],
    improved: [],
    links: [
      { label: "Ouvrir le tableur", href: "/tableur" },
    ],
  },
  {
    id: "noir-cinema-member-name-contrast",
    version: "2.9",
    date: "2026-07-29",
    title: "Les prénoms ressortent dans Noir Cinéma",
    summary: "Les noms des membres associés aux albums restent maintenant parfaitement lisibles sur les cartes sombres du thème Noir Cinéma.",
    categories: ["Correction", "Profil", "Albums"],
    added: [],
    fixed: [
      { text: "Les prénoms affichés après « Proposé par » et « Écouté par » utilisent désormais la couleur claire du thème, dans les cartes classiques comme dans les listes." },
    ],
    improved: [],
    links: [
      { label: "Voir les membres", href: "/membres" },
    ],
  },
  {
    id: "collapsible-listening-workspaces",
    version: "2.8",
    date: "2026-07-29",
    title: "Les espaces d’écoute savent maintenant se faire petits",
    summary: "Les formulaires d’avis bonus et d’écoute supplémentaire peuvent être réduits à leur titre pour libérer rapidement de la place dans la sélection.",
    categories: ["Amélioration", "Albums", "Tirages", "Écoutes bonus"],
    added: [],
    fixed: [],
    improved: [
      { text: "Le bouton « Réduire » masque l’album, les formulaires et les listes tout en conservant les saisies en cours." },
      { text: "Le bandeau compact garde le titre visible et propose immédiatement l’action « Déplier », sur ordinateur comme sur mobile." },
    ],
    links: [
      { label: "Ouvrir le tableur", href: "/tableur" },
    ],
  },
  {
    id: "extra-listenings-on-member-profiles",
    version: "2.7",
    date: "2026-07-29",
    title: "Les écoutes supplémentaires rejoignent les profils",
    summary: "Les albums supplémentaires apparaissent maintenant dans les propositions et les écoutes des membres, sans être confondus avec les albums des tirages classiques.",
    categories: ["Amélioration", "Profil", "Albums", "Tirages"],
    added: [],
    fixed: [],
    improved: [
      { text: "Une proposition supplémentaire rejoint la liste « a proposé » du membre qui a choisi l’album." },
      { text: "Une écoute supplémentaire terminée rejoint la liste « a écouté » du membre qui a rendu son verdict." },
      { text: "Chaque carte indique clairement « Écoute supplémentaire · Tirage XX » ou « Tirage classique · Tirage XX »." },
    ],
    links: [
      { label: "Voir les membres", href: "/membres" },
      { label: "Ouvrir le tableur", href: "/tableur" },
    ],
  },
  {
    id: "extra-listening-requests",
    version: "2.6",
    date: "2026-07-28",
    title: "Une écoute supplémentaire, choisie rien que pour toi",
    summary: "Tu peux maintenant demander à un membre du tirage de te proposer un album inédit, puis publier ton verdict dans une section séparée du tirage classique.",
    categories: ["Nouvelle fonctionnalité", "Amélioration", "Albums", "Tirages"],
    added: [
      { text: "Chaque tirage possède désormais son sous-tableau « Écoutes supplémentaires », clairement identifié comme hors tirage classique." },
      { text: "Le membre choisi reçoit la demande, propose son album avec l’aide Deezer, puis le demandeur peut enregistrer son avis, sa note et ses morceaux marquants." },
      { text: "Les demandes et propositions déclenchent les notifications utiles sans créer de nouvelle place dans le tirage." },
    ],
    fixed: [
      { text: "Le parcours existant porte maintenant le nom précis « Donner un avis bonus sur un album du tirage » afin de ne plus le confondre avec une nouvelle proposition." },
      { text: "Remplacer un album conserve désormais son numéro d’archive, même si la proposition est retirée puis recréée ; le trou observé après l’archive 70 est réparé." },
      { text: "Les administrateurs peuvent désormais supprimer définitivement une écoute supplémentaire ajoutée par erreur." },
    ],
    improved: [
      { text: "Les écoutes supplémentaires restent en dehors des moyennes, affectations et classements officiels." },
      { text: "Les demandes d’écoute supplémentaire sont limitées au seul tirage actuel : aucun ancien tirage ne peut être sélectionné." },
      { text: "Le sous-tableau réunit maintenant l’album et l’artiste, masque le statut et rend l’album, la best track, la worst track et l’avis complet directement accessibles." },
    ],
    links: [
      { label: "Ouvrir le tableur", href: "/tableur" },
    ],
  },
  {
    id: "unified-image-upload-fields",
    version: "2.5",
    date: "2026-07-28",
    title: "Les imports d’images parlent enfin le même langage",
    summary: "Tous les sélecteurs d’images partagent maintenant une interface accessible avec nom de fichier, contraintes réelles et aperçu local.",
    categories: ["Correction", "Amélioration", "Profil", "Albums", "Mèmes", "Administration"],
    added: [
      { text: "Un composant d’import commun affiche un bouton explicite, le fichier sélectionné, les formats acceptés, la taille maximale et un aperçu carré." },
    ],
    fixed: [
      { text: "Les libellés natifs « Choisir un fichier / Aucun fichier choisi » ont disparu des six formulaires d’image du site." },
      { text: "La photo d’un artiste favori n’est plus envoyée dès sa sélection : elle attend maintenant le bouton d’enregistrement du podium." },
      { text: "Les actions « Voir le profil » sont plus compactes sur ordinateur, alignées en bas et restent confortables sur mobile." },
    ],
    improved: [
      { text: "Le clavier, le focus visible, l’annonce du nom de fichier, les erreurs de format et les états d’attente utilisent désormais le même comportement partout." },
    ],
    links: [
      { label: "Personnaliser mon profil", href: "/compte" },
      { label: "Voir les mèmes", href: "/memes" },
      { label: "Ouvrir le tableur", href: "/tableur" },
    ],
  },
  {
    id: "uniform-theme-profile-buttons",
    version: "2.4",
    date: "2026-07-28",
    title: "Les aper\u00e7us de profils s\u2019alignent",
    summary: "Tous les th\u00e8mes affichent maintenant une action \u00ab Voir le profil \u00bb de m\u00eame taille, bien align\u00e9e au bas de chaque carte.",
    categories: ["Correction", "Am\u00e9lioration", "Profil"],
    added: [],
    fixed: [
      { text: "Les boutons de Punk Poster, Jazz Lounge et Acid Rave ne s\u2019agrandissent plus par rapport aux autres th\u00e8mes." },
      { text: "Le bouton du th\u00e8me Wheely conserve d\u00e9sormais exactement la m\u00eame hauteur et le m\u00eame alignement que ses voisins." },
    ],
    improved: [
      { text: "Une rang\u00e9e d\u2019action commune de 44 pixels garde toutes les cartes r\u00e9guli\u00e8res et tactiles, quelle que soit la longueur de leur contenu." },
    ],
    links: [
      { label: "Choisir un th\u00e8me", href: "/compte" },
      { label: "Voir les membres", href: "/membres" },
    ],
  },
  {
    id: "wheely-real-finale-unlock-fix",
    version: "2.3",
    date: "2026-07-26",
    title: "Wheely gagne une vraie ligne d’arrivée",
    summary: "La fin du morceau devient une séquence à part entière et le déblocage du thème est fiabilisé de bout en bout.",
    categories: ["Correction", "Amélioration"],
    added: [
      { text: "À la dernière note, un vinyle animé ralentit et referme la face avant l’affichage du score final." },
    ],
    fixed: [
      { text: "Le d\u00e9blocage utilise maintenant une partie horodat\u00e9e par Supabase et la session authentifi\u00e9e du joueur, sans aucune cl\u00e9 administrateur dans Vercel." },
      { text: "Les appels de début et de fin de partie sont retentés automatiquement en cas de panne réseau temporaire, puis l’écriture est relue dans la base avant d’annoncer le thème comme débloqué." },
    ],
    improved: [
      { text: "Dès la fin de la musique, aucun obstacle ni mur d’album supplémentaire n’apparaît ; les éléments en piste sortent sans provoquer de collision." },
    ],
    links: [
      { label: "Jouer à Wheely", href: "/" },
      { label: "Choisir le thème", href: "/compte" },
    ],
  },
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
