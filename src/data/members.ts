import type { Member } from "@/types/member";
import memberRoster from "./members.json";

// Thomas et Toma désignent la même personne : le nom public retenu est Toma.
// L'ordre du catalogue est alphabétique pour tous les affichages du club.
export const members = memberRoster as Member[];

export const getMember = (slug: string) => members.find((member) => member.slug === slug);

export const getMemberDisplayName = (name: string | null) => {
  if (!name) return "Non renseigné";
  const key = name.trim().toLocaleLowerCase();
  return members.find((member) => [member.slug, member.username, member.displayName].some((value) => value?.toLocaleLowerCase() === key))?.displayName ?? name;
};
