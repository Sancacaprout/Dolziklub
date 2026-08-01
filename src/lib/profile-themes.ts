export const profileThemeIds = [
  "dol-ziklub",
  "archive",
  "dark-vinyl",
  "fanzine",
  "neon-club",
  "natural-tape",
  "chrome-2000",
  "city-pop",
  "punk-poster",
  "jazz-lounge",
  "acid-rave",
  "wheely",
  "noir-cinema",
  "manga-panel",
  "cassette-sunset",
  "museum-white",
  "custom",
] as const;

export type ProfileThemeId = (typeof profileThemeIds)[number];
export const wheelyThemeAssets = {
  character: "/game/character/wheely.png",
  obstacles: [
    { id: "blocker-a", src: "/game/obstacles/blocker-a.png" },
    { id: "blocker-b", src: "/game/obstacles/blocker-b.png" },
    { id: "low-barrier", src: "/game/obstacles/low-barrier.png" },
    { id: "overhead-barrier", src: "/game/obstacles/overhead-barrier.png" },
  ],
} as const;

export type ProfileTheme = {
  id: ProfileThemeId;
  name: string;
  description: string;
  previewColors: readonly [string, string, string];
  artPath: string;
  previewVariant?: "default" | "wheely";
  previewMotif?:
    | "classic"
    | "archive-file"
    | "fanzine-collage"
    | "chrome-player"
    | "cinema-screen"
    | "manga-page"
    | "cassette-deck"
    | "museum-label"
    | "custom-editor"
    | "wheely";
};

export const profileThemes: readonly ProfileTheme[] = [
  { id: "dol-ziklub", name: "DOL ZIKLUB", description: "La fiche d’origine du club, sans habillage ajouté.", previewColors: ["#C8E7FF", "#183650", "#CCF51D"], artPath: "/profile-themes/dol-ziklub/club-grid.svg", previewMotif: "classic" },
  { id: "archive", name: "Archive", description: "Dossiers classés, tampons rouges et papier vieilli.", previewColors: ["#E9DFC8", "#30291F", "#A83A2A"], artPath: "/profile-themes/archive/paper-stamp.svg", previewMotif: "archive-file" },
  { id: "dark-vinyl", name: "Dark Vinyl", description: "Studio nocturne, sillons et reflets brûlés.", previewColors: ["#121211", "#EEE8DA", "#B64A2D"], artPath: "/profile-themes/dark-vinyl/vinyl-grooves.svg" },
  { id: "fanzine", name: "Fanzine", description: "Photocopies, collages, ruban et marqueur rouge.", previewColors: ["#F5F0DF", "#0B0B0B", "#E1261C"], artPath: "/profile-themes/fanzine/cutout-stars.svg", previewMotif: "fanzine-collage" },
  { id: "neon-club", name: "Neon Club", description: "Nuit bleue, violet électrique et rose néon.", previewColors: ["#10122D", "#F8F7FF", "#FB4FE5"], artPath: "/profile-themes/neon-club/laser-grid.svg" },
  { id: "natural-tape", name: "Natural Tape", description: "Carton, olive et collection personnelle.", previewColors: ["#E9DFC9", "#3B392A", "#7B8350"], artPath: "/profile-themes/natural-tape/tape-leaf.svg" },
  { id: "chrome-2000", name: "Chrome 2000", description: "Lecteur multimédia Y2K, chrome et bleu électrique.", previewColors: ["#EAF4FF", "#101B2E", "#1377FF"], artPath: "/profile-themes/chrome-2000/cd-orbit.svg", previewMotif: "chrome-player" },
  { id: "city-pop", name: "City Pop", description: "Ville nocturne, rose doux et soleil rétro.", previewColors: ["#15254D", "#FFF7E8", "#FA94AE"], artPath: "/profile-themes/city-pop/sunset-grid.svg" },
  { id: "punk-poster", name: "Punk Poster", description: "Affiche déchirée, noir, blanc et rouge frontal.", previewColors: ["#F6F3EB", "#090909", "#EF2720"], artPath: "/profile-themes/punk-poster/torn-ticket.svg" },
  { id: "jazz-lounge", name: "Jazz Lounge", description: "Bordeaux, doré discret et velours de club.", previewColors: ["#3C101B", "#F4E7D1", "#C9A35C"], artPath: "/profile-themes/jazz-lounge/lounge-notes.svg" },
  { id: "acid-rave", name: "Acid Rave", description: "Flyer technique, vert acide et jaune fluorescent.", previewColors: ["#111312", "#F2F4EE", "#C8FF00"], artPath: "/profile-themes/acid-rave/scanner-grid.svg" },
  { id: "wheely", name: "Wheely", description: "Profil arcade : vinyle géant, skateboard et score de runner musical.", previewColors: ["#111111", "#F4EFE4", "#B5F50D"], artPath: wheelyThemeAssets.character, previewVariant: "wheely", previewMotif: "wheely" },
  { id: "noir-cinema", name: "Noir Cinéma", description: "Salle obscure, pellicule, velours rouge et générique doré.", previewColors: ["#090909", "#F0E9DB", "#A71924"], artPath: "", previewMotif: "cinema-screen" },
  { id: "manga-panel", name: "Manga Panel", description: "Cases dynamiques, trames, bulles et encre noire.", previewColors: ["#FAF8F0", "#090909", "#E3312D"], artPath: "", previewMotif: "manga-page" },
  { id: "cassette-sunset", name: "Cassette Sunset", description: "Mixtape rétro, coucher de soleil et écran d’autoradio.", previewColors: ["#24153D", "#F6D3A2", "#F36B46"], artPath: "", previewMotif: "cassette-deck" },
  { id: "museum-white", name: "Museum White", description: "Galerie contemporaine, cartels fins et espace blanc.", previewColors: ["#F8F6F0", "#171717", "#9B2B27"], artPath: "", previewMotif: "museum-label" },
  { id: "custom", name: "PERSONNALISÉ", description: "Crée un univers de profil unique, jusque dans les moindres détails.", previewColors: ["#11131D", "#F4E9D8", "#D94B36"], artPath: "", previewMotif: "custom-editor" },
] as const;

export const defaultProfileTheme: ProfileThemeId = "dol-ziklub";

export function isProfileThemeId(value: unknown): value is ProfileThemeId {
  return typeof value === "string" && profileThemeIds.includes(value as ProfileThemeId);
}
