const INTERNAL_AUTH_DOMAIN = "auth.dolziklub.local";
export function normalizeUsername(username: string) {
  return username.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function usernameToInternalEmail(username: string) {
  const normalized = normalizeUsername(username);
  if (!normalized) throw new Error("Identifiant invalide");
  return `${normalized}@${INTERNAL_AUTH_DOMAIN}`;
}
