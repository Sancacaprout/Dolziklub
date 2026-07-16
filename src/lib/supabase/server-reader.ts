import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let reader: SupabaseClient | null = null;

export function getSupabaseServerReader() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase_read_unavailable");

  return reader ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getOptionalSupabaseServerReader() {
  try {
    return getSupabaseServerReader();
  } catch {
    return null;
  }
}
