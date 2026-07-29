import type { ProfileCustomThemeAssetMap } from "@/lib/profile-custom-theme/types";

export const PROFILE_THEME_ASSET_BUCKET = "profile-theme-assets";
export const PROFILE_THEME_ASSET_INPUT_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_THEME_ASSET_OUTPUT_MAX_BYTES = 1_500 * 1024;
export const PROFILE_THEME_ASSET_MAX_DIMENSION = 2048;
export const PROFILE_THEME_ASSET_MAX_PIXELS = 25_000_000;
export const PROFILE_THEME_ASSET_SIGNED_URL_TTL_SECONDS = 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProfileCustomThemeAsset = {
  id: string;
  signedUrl: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt: string;
};

function storageOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
}

export function isSafeProfileThemeAssetUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 4_096) return false;
  const allowedOrigin = storageOrigin();
  if (!allowedOrigin) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.origin === allowedOrigin &&
      url.pathname.startsWith(
        `/storage/v1/object/sign/${PROFILE_THEME_ASSET_BUCKET}/`,
      ) &&
      url.searchParams.has("token")
    );
  } catch {
    return false;
  }
}

export function sanitizeProfileThemeAssetMap(
  value: unknown,
): ProfileCustomThemeAssetMap | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 9) return null;
  const safe: ProfileCustomThemeAssetMap = {};
  for (const [id, url] of entries) {
    if (!UUID.test(id) || !isSafeProfileThemeAssetUrl(url)) return null;
    safe[id] = url as string;
  }
  return safe;
}

export function referencedProfileThemeAssetIds(config: {
  backgrounds: { image: { assetId: string | null } };
  decorations: Array<{ assetId: string }>;
}) {
  return Array.from(new Set([
    ...(config.backgrounds.image.assetId ? [config.backgrounds.image.assetId] : []),
    ...config.decorations.map((decoration) => decoration.assetId),
  ])).slice(0, 9);
}
