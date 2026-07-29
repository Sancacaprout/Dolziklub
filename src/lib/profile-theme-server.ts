import "server-only";

import {
  isProfileCustomThemeEditorEnabled,
} from "@/lib/profile-custom-theme/feature-flag";
import {
  validateProfileCustomThemeConfig,
} from "@/lib/profile-custom-theme/validator";
import type { ProfileCustomThemeConfigV1 } from "@/lib/profile-custom-theme/types";
import {
  isProfileThemeId,
  type ProfileThemeId,
} from "@/lib/profile-themes";
import { getOptionalSupabaseServerReader } from "@/lib/supabase/server-reader";

export type PublishedProfileTheme = {
  id: Exclude<ProfileThemeId, "dol-ziklub"> | null;
  customConfig: ProfileCustomThemeConfigV1 | null;
};

const emptyPublishedProfileTheme: PublishedProfileTheme = {
  id: null,
  customConfig: null,
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
    return { id: profile.profile_theme, customConfig: null };
  }
  if (!isProfileCustomThemeEditorEnabled()) return emptyPublishedProfileTheme;

  const { data: publication } = await supabase
    .from("profile_custom_theme_publications")
    .select("config")
    .eq("participant_id", profile.id)
    .maybeSingle();
  const validation = validateProfileCustomThemeConfig(publication?.config);
  if (!validation.ok) return emptyPublishedProfileTheme;
  return { id: "custom", customConfig: validation.value };
}
