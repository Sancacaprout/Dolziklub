import type { Member } from "@/types/member";

// Thomas et Toma désignent la même personne : le nom public retenu est Toma.
// L'ordre du catalogue est alphabétique pour tous les affichages du club.
export const members: Member[] = [
  { slug: "alain", displayName: "Alain", username: "alain", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "bono", displayName: "Bono", username: "bono", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "chacha", displayName: "Chacha", username: "chacha", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "dod", displayName: "Dod", username: "dod", role: "admin", bio: null, dataStatus: "confirmed" },
  { slug: "enzo", displayName: "Enzo", username: "enzo", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "kougna", displayName: "Kougna", username: "kougna", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "motem", displayName: "Motem", username: "motem", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "pep", displayName: "Pep", username: "pep", role: "member", bio: null, dataStatus: "confirmed" },
  { slug: "toma", displayName: "Toma", username: "thomas", role: "admin", bio: null, dataStatus: "confirmed" },
  { slug: "yuna", displayName: "Yuna", username: "yuna", role: "member", bio: null, dataStatus: "confirmed" },
];

export const getMember = (slug: string) => members.find((member) => member.slug === slug);

export const getMemberDisplayName = (name: string | null) => {
  if (!name) return "Non renseigné";
  const key = name.trim().toLocaleLowerCase();
  return members.find((member) => [member.slug, member.username, member.displayName].some((value) => value?.toLocaleLowerCase() === key))?.displayName ?? name;
};
