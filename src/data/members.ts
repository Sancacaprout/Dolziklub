import type { Member } from "@/types/member";

// Les noms proviennent des consignes et des archives de mèmes. Les relations
// album/personne ne sont pas disponibles dans les fichiers fournis.
export const members: Member[] = [
  { slug: "thomas", displayName: "Thomas", username: "thomas", role: "admin", bio: null, dataStatus: "needs-review" },
  { slug: "toma", displayName: "Toma", username: "toma", role: "member", bio: null, dataStatus: "needs-review" },
  { slug: "dod", displayName: "Dod", username: "dod", role: "admin", bio: null, dataStatus: "confirmed" },
  { slug: "pep", displayName: "Pep", username: "pep", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "motem", displayName: "Motem", username: "motem", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "chacha", displayName: "Chacha", username: "chacha", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "yuna", displayName: "Yuna", username: "yuna", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "enzo", displayName: "Enzo", username: "enzo", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "bono", displayName: "Bono", username: "bono", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "kougna", displayName: "Kougna", username: "kougna", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "alain", displayName: "Alain", username: "alain", role: "member", bio: null, dataStatus: "confirmed" },
];

export const getMember = (slug: string) => members.find((member) => member.slug === slug);
