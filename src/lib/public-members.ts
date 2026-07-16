import "server-only";

import { memberIdentityKeys, members as archivedMembers } from "@/data/members";
import { getOptionalSupabaseServerReader } from "@/lib/supabase/server-reader";
import { slugify } from "@/lib/slug";
import type { Member } from "@/types/member";

const titleCase = (value: string) =>
  value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");

export async function getSynchronizedMembers(): Promise<Member[]> {
  const supabase = getOptionalSupabaseServerReader();
  if (!supabase) return archivedMembers;
  const { data, error } = await supabase
    .from("member_public_profiles")
    .select("username")
    .order("username", { ascending: true });
  if (error) return archivedMembers;

  const membersByIdentity = new Map<string, Member>();
  for (const member of archivedMembers) {
    for (const name of memberIdentityKeys(member)) membersByIdentity.set(name, member);
  }

  const merged = [...archivedMembers];
  for (const profile of data ?? []) {
    const username = profile.username?.trim();
    if (!username || membersByIdentity.has(username.toLocaleLowerCase())) continue;
    const displayName = titleCase(username);
    merged.push({
      slug: slugify(username),
      displayName,
      username,
      role: "member",
      bio: null,
      dataStatus: "confirmed",
    });
  }

  return merged.sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
}

export async function getSynchronizedMember(slug: string) {
  const key = slug.trim().toLocaleLowerCase();
  return (await getSynchronizedMembers()).find((member) => memberIdentityKeys(member).includes(key)) ?? null;
}
