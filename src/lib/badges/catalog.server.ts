import "server-only";
import type { BadgeCategory, BadgeKey, BadgeRarity } from "@/lib/badges/types";

export type BadgeDefinition = {
  key: BadgeKey;
  name: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  secret: boolean;
  imagePath: `/badges/${BadgeKey}.png`;
};

const row = (key: BadgeKey, name: string, category: BadgeCategory, rarity: BadgeRarity, secret = false): BadgeDefinition =>
  ({ key, name, category, rarity, secret, imagePath: `/badges/${key}.png` });

export const badgeCatalog = [
  row("b01", "Première galette", "proposal", "common"),
  row("b02", "Fournisseur officiel", "proposal", "common"),
  row("b03", "Disquaire du club", "proposal", "rare"),
  row("b04", "Catalogue humain", "proposal", "legendary"),
  row("b05", "Triple validation", "proposal", "rare"),
  row("b06", "Proposition criminelle", "proposal", "uncommon", true),
  row("b07", "Sans aucun remords", "proposal", "rare"),
  row("b08", "La classe à Dallas", "proposal", "legendary"),
  row("b09", "Premier verdict", "review", "common"),
  row("b10", "Oreilles ouvertes", "listening", "common"),
  row("b11", "Auditeur confirmé", "listening", "rare"),
  row("b12", "Machine à écouter", "listening", "legendary"),
  row("b13", "Travail supplémentaire", "listening", "common"),
  row("b14", "Heures supplémentaires", "listening", "rare"),
  row("b15", "Aucun album abandonné", "listening", "legendary", true),
  row("b16", "Critique appliqué", "review", "uncommon"),
  row("b17", "La plume du club", "review", "legendary"),
  row("b18", "Cœur d’artichaut", "review", "rare"),
  row("b19", "Incorruptible", "review", "rare"),
  row("b20", "Le juste milieu", "review", "rare"),
  row("b21", "Tout ou rien", "review", "uncommon"),
  row("b22", "Public difficile", "review", "rare"),
  row("b23", "Bon public", "review", "rare"),
  row("b24", "Premier tour de piste", "game", "uncommon"),
  row("b25", "Wheely Rider", "game", "legendary"),
  row("b26", "Victime du Tribunal", "tribunal", "legendary", true),
  row("b27", "Express", "review", "rare"),
  row("b28", "Dernière minute", "review", "rare"),
  row("b29", "Revenant", "review", "legendary", true),
] as const satisfies readonly BadgeDefinition[];
