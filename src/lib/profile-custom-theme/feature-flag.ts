import "server-only";

export function isProfileCustomThemeEditorEnabled() {
  return process.env.PROFILE_CUSTOM_THEME_EDITOR_ENABLED?.trim().toLocaleLowerCase() === "true";
}
