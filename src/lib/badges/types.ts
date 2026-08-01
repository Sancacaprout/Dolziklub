export const badgeKeys = [
  "b01", "b02", "b03", "b04", "b05", "b06", "b07", "b08", "b09", "b10",
  "b11", "b12", "b13", "b14", "b15", "b16", "b17", "b18", "b19", "b20",
  "b21", "b22", "b23", "b24", "b25", "b26", "b27", "b28", "b29",
] as const;

export type BadgeKey = (typeof badgeKeys)[number];
export type BadgeState = "locked" | "unlocked_unclaimed" | "claimed" | "equipped";
export type BadgeCategory = "proposal" | "listening" | "review" | "game" | "tribunal";
export type BadgeRarity = "common" | "uncommon" | "rare" | "legendary";

export type BadgeProgress = { current: number; target: number };

export type MemberBadge = {
  key: BadgeKey;
  name: string;
  description: string;
  imagePath: string | null;
  category: BadgeCategory;
  rarity: BadgeRarity;
  secret: boolean;
  state: BadgeState;
  unlockedAt: string | null;
  claimedAt: string | null;
  slot: 1 | 2 | 3 | null;
  progress: BadgeProgress | null;
};

export type BadgeCollectionPayload = {
  badges: MemberBadge[];
  equippedCount: number;
  unclaimedCount: number;
};

export type PublicBadge = {
  badge_key: BadgeKey;
  name: string;
  description: string;
  image_path: string;
  rarity: BadgeRarity;
  slot: 1 | 2 | 3;
};
