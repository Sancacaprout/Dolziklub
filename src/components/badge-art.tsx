import Image from "next/image";
import type { BadgeRarity } from "@/lib/badges/types";

export function BadgeArt({
  imagePath,
  name,
  rarity,
  size = 128,
  locked = false,
}: {
  imagePath: string | null;
  name: string;
  rarity: BadgeRarity;
  size?: number;
  locked?: boolean;
}) {
  return (
    <span className={`badge-art badge-art--${rarity}${locked ? " is-locked" : ""}`}>
      {imagePath ? (
        <Image src={imagePath} alt={`Badge ${name}`} width={size} height={size} sizes={`${size}px`} />
      ) : (
        <span className="badge-art__secret" aria-label="Illustration secrète">?</span>
      )}
    </span>
  );
}
