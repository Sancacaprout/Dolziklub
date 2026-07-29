import type {
  ProfileCustomThemeAssetMap,
  ProfileCustomThemeConfigV1,
} from "@/lib/profile-custom-theme";

type DecorationStyle = React.CSSProperties & {
  "--profile-custom-decoration-size": string;
  "--profile-custom-decoration-opacity": number;
  "--profile-custom-decoration-rotation": string;
  "--profile-custom-decoration-scale-x": number;
};

export function ProfileCustomThemeDecorations({
  config,
  assets,
}: {
  config: ProfileCustomThemeConfigV1;
  assets: ProfileCustomThemeAssetMap;
}) {
  return (
    <div className="profile-custom-decorations" aria-hidden="true">
      {config.decorations.flatMap((decoration) => {
        const source = assets[decoration.assetId];
        if (!source) return [];
        const style: DecorationStyle = {
          "--profile-custom-decoration-size": `${decoration.size}px`,
          "--profile-custom-decoration-opacity": decoration.opacity,
          "--profile-custom-decoration-rotation": `${decoration.rotation}deg`,
          "--profile-custom-decoration-scale-x": decoration.mirror ? -1 : 1,
        };
        return [
          <span
            key={decoration.id}
            className="profile-custom-decoration"
            data-decoration-slot={decoration.slot}
            data-decoration-visibility={decoration.visibility}
            style={style}
          >
            {/* Assets are decoded and rewritten to WebP by the server route. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={source} alt="" draggable={false} />
          </span>,
        ];
      })}
    </div>
  );
}
