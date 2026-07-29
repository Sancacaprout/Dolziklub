import "server-only";
import {
  PROFILE_THEME_ASSET_BUCKET,
  PROFILE_THEME_ASSET_SIGNED_URL_TTL_SECONDS,
  sanitizeProfileThemeAssetMap,
} from "@/lib/profile-custom-theme/assets";

import {
  isProfileCustomThemeEditorEnabled,
} from "@/lib/profile-custom-theme/feature-flag";
import {
  validateProfileCustomThemeConfig,
} from "@/lib/profile-custom-theme/validator";
import type { ProfileCustomThemeAssetMap, ProfileCustomThemeConfigV1 } from "@/lib/profile-custom-theme/types";
import {
  isProfileThemeId,
  type ProfileThemeId,
} from "@/lib/profile-themes";
import { getOptionalSupabaseServerReader } from "@/lib/supabase/server-reader";

export type PublishedProfileTheme = {
  id: Exclude<ProfileThemeId, "dol-ziklub"> | null;
  customConfig: ProfileCustomThemeConfigV1 | null;
  customAssets: ProfileCustomThemeAssetMap;
};

const emptyPublishedProfileTheme: PublishedProfileTheme = {
  id: null,
  customConfig: null,
  customAssets: {},
};

export async function getPublishedProfileTheme(
  username: string | null,
): Promise<PublishedProfileTheme> {
  if (!username) return emptyPublishedProfileTheme;
  const supabase = getOptionalSupabaseServerReader();
  if (!supabase) return emptyPublishedProfileTheme;

  const { data: profile } = await supabase
    .from("member_public_profiles")
    .select("id,profile_theme,profile_theme_selected_at")
    .eq("username", username)
    .maybeSingle();

  if (
    !profile?.profile_theme_selected_at ||
    !isProfileThemeId(profile.profile_theme) ||
    profile.profile_theme === "dol-ziklub"
  ) return emptyPublishedProfileTheme;

  if (profile.profile_theme !== "custom") {
    return { id: profile.profile_theme, customConfig: null, customAssets: {} };
  }
  if (!isProfileCustomThemeEditorEnabled()) return emptyPublishedProfileTheme;

  const { data: publication } = await supabase
    .from("profile_custom_theme_publications")
    .select("config,asset_ids")
    .eq("participant_id", profile.id)
    .maybeSingle();
  const validation = validateProfileCustomThemeConfig(publication?.config);
  if (!validation.ok) return emptyPublishedProfileTheme;
  const assetIds = Array.isArray(publication?.asset_ids)
    ? publication.asset_ids.filter((value): value is string => typeof value === "string")
    : [];
  let customAssets: ProfileCustomThemeAssetMap = {};
  if (assetIds.length) {
    const { data: rows } = await supabase
      .from("profile_custom_theme_assets")
      .select("id,storage_path")
      .in("id", assetIds);
    const paths = (rows ?? []).map((row) => row.storage_path as string);
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from(PROFILE_THEME_ASSET_BUCKET)
        .createSignedUrls(paths, PROFILE_THEME_ASSET_SIGNED_URL_TTL_SECONDS);
      const byPath = new Map((signed ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
      const candidate = Object.fromEntries((rows ?? []).flatMap((row) => {
        const signedUrl = byPath.get(row.storage_path as string);
        return signedUrl ? [[row.id as string, signedUrl]] : [];
      }));
      customAssets = sanitizeProfileThemeAssetMap(candidate) ?? {};
    }
  }
  return { id: "custom", customConfig: validation.value, customAssets };
}
