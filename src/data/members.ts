import type { Member } from "@/types/member";
import memberRoster from "./members.json";

// Thomas et Toma désignent la même personne : le nom public retenu est Toma.
// L'ordre du catalogue est alphabétique pour tous les affichages du club.
export const members = memberRoster as Member[];

export const memberIdentityKeys = (member: Member) =>
  [member.slug, member.username, member.displayName]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLocaleLowerCase());

export const getMemberByIdentity = (name: string | null) => {
  const key = name?.trim().toLocaleLowerCase();
  if (!key) return undefined;
  return members.find((member) => memberIdentityKeys(member).includes(key));
};

export const getMember = (slug: string) => getMemberByIdentity(slug);

export const isSameMemberIdentity = (name: string | null, memberSlug: string) => {
  const target = getMemberByIdentity(memberSlug);
  const source = getMemberByIdentity(name);
  if (target && source) return target.slug === source.slug;
  return name?.trim().toLocaleLowerCase() === memberSlug.trim().toLocaleLowerCase();
};

export const getMemberDisplayName = (name: string | null) => {
  if (!name) return "Non renseigné";
  return getMemberByIdentity(name)?.displayName ?? name;
};