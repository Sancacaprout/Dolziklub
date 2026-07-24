import Image from "next/image";
import { wheelyThemeAssets } from "@/lib/profile-themes";

export type WheelyThemeArtVariant = "profile" | "preview" | "card";

export function WheelyThemeArt({ variant }: { variant: WheelyThemeArtVariant }) {
  return (
    <span className={`wheely-theme-art wheely-theme-art--${variant}`} aria-hidden="true">
      <span className="wheely-theme-art__hud">
        <b>WHEELY RIDER</b>
        <small>READY · VINYL RUN</small>
      </span>
      <span className="wheely-theme-art__vinyl" />
      <span className="wheely-theme-art__lanes" />
      {wheelyThemeAssets.obstacles.map((obstacle) => (
        <Image
          key={obstacle.id}
          className={`wheely-theme-art__obstacle wheely-theme-art__obstacle--${obstacle.id}`}
          src={obstacle.src}
          alt=""
          width={160}
          height={220}
          sizes={variant === "profile" ? "110px" : "52px"}
        />
      ))}
      <Image
        className="wheely-theme-art__character"
        src={wheelyThemeAssets.character}
        alt=""
        width={240}
        height={300}
        sizes={variant === "profile" ? "240px" : "100px"}
        priority={variant === "profile"}
      />
      <span className="wheely-theme-art__finish">CHECKPOINT 03</span>
    </span>
  );
}
