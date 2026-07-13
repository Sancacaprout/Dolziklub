import "server-only";
import { createClient } from "@supabase/supabase-js";
let client: ReturnType<typeof createClient> | null = null;
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Client administrateur Supabase non configuré.");
  return client ??= createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
