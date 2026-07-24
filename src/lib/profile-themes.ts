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
};

export const profileThemes: readonly ProfileTheme[] = [
  { id: "dol-ziklub", name: "DOL ZIKLUB", description: "La fiche d’origine du club, sans habillage ajouté.", previewColors: ["#C8E7FF", "#183650", "#CCF51D"], artPath: "/profile-themes/dol-ziklub/club-grid.svg" },
  { id: "archive", name: "Archive", description: "Le dossier musical d’origine, papier et encre.", previewColors: ["#F4F0E8", "#171715", "#D7462E"], artPath: "/profile-themes/archive/paper-stamp.svg" },
  { id: "dark-vinyl", name: "Dark Vinyl", description: "Studio nocturne, sillons et reflets brûlés.", previewColors: ["#121211", "#EEE8DA", "#B64A2D"], artPath: "/profile-themes/dark-vinyl/vinyl-grooves.svg" },
  { id: "fanzine", name: "Fanzine", description: "Photocopies, annotations et rouge vif.", previewColors: ["#F8F4E9", "#111111", "#E1261C"], artPath: "/profile-themes/fanzine/cutout-stars.svg" },
  { id: "neon-club", name: "Neon Club", description: "Nuit bleue, violet électrique et rose néon.", previewColors: ["#10122D", "#F8F7FF", "#FB4FE5"], artPath: "/profile-themes/neon-club/laser-grid.svg" },
  { id: "natural-tape", name: "Natural Tape", description: "Carton, olive et collection personnelle.", previewColors: ["#E9DFC9", "#3B392A", "#7B8350"], artPath: "/profile-themes/natural-tape/tape-leaf.svg" },
  { id: "chrome-2000", name: "Chrome 2000", description: "Lecteur CD, bleu électrique et métal froid.", previewColors: ["#E8EDF3", "#15202F", "#2073FF"], artPath: "/profile-themes/chrome-2000/cd-orbit.svg" },
  { id: "city-pop", name: "City Pop", description: "Ville nocturne, rose doux et soleil rétro.", previewColors: ["#15254D", "#FFF7E8", "#FA94AE"], artPath: "/profile-themes/city-pop/sunset-grid.svg" },
  { id: "punk-poster", name: "Punk Poster", description: "Affiche déchirée, noir, blanc et rouge frontal.", previewColors: ["#F6F3EB", "#090909", "#EF2720"], artPath: "/profile-themes/punk-poster/torn-ticket.svg" },
  { id: "jazz-lounge", name: "Jazz Lounge", description: "Bordeaux, doré discret et velours de club.", previewColors: ["#3C101B", "#F4E7D1", "#C9A35C"], artPath: "/profile-themes/jazz-lounge/lounge-notes.svg" },
  { id: "acid-rave", name: "Acid Rave", description: "Flyer technique, vert acide et jaune fluorescent.", previewColors: ["#111312", "#F2F4EE", "#C8FF00"], artPath: "/profile-themes/acid-rave/scanner-grid.svg" },
  { id: "wheely", name: "Wheely", description: "Profil arcade : vinyle géant, skateboard et score de runner musical.", previewColors: ["#111111", "#F4EFE4", "#B5F50D"], artPath: wheelyThemeAssets.character, previewVariant: "wheely" },
] as const;

export const defaultProfileTheme: ProfileThemeId = "dol-ziklub";

export function isProfileThemeId(value: unknown): value is ProfileThemeId {
  return typeof value === "string" && profileThemeIds.includes(value as ProfileThemeId);
}
