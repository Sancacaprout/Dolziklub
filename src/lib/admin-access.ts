import "server-only";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
type AdminAccess =
  | { status: "admin"; client: Client; actorId: string }
  | { status: "signed-out" | "forbidden" | "unavailable" };

export async function getAdminAccess(): Promise<AdminAccess> {
  try {
    const client = await createSupabaseServerClient();
    if (!client) return { status: "unavailable" };
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError) {
      const signedOut = isAuthSessionMissingError(authError) || authError.status === 401 || authError.status === 403;
      return { status: signedOut ? "signed-out" : "unavailable" };
    }
    if (!user) return { status: "signed-out" };

    const { data, error } = await client.from("member_profiles").select("role").eq("id", user.id).maybeSingle();
    if (error) return { status: "unavailable" };
    return data?.role === "admin" ? { status: "admin", client, actorId: user.id } : { status: "forbidden" };
  } catch {
    return { status: "unavailable" };
  }
}
