import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ProfileThemeRequestAuth = {
  client: SupabaseClient;
  userId: string;
};

export async function authenticateProfileThemeRequest(
  request: Request,
): Promise<ProfileThemeRequestAuth | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}
