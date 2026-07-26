import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { authenticatedUser, error } from "@/lib/music-server";

export const dynamic = "force-dynamic";

const ACHIEVEMENT_KEY = "wheely-theme";
const MINIMUM_RUN_MS = 72_000;
const RUN_TOKEN_TTL_MS = 30 * 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function userScopedClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) {
    throw new Error("wheely_user_client_unavailable");
  }
  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function hasUnlockedTheme(client: ReturnType<typeof userScopedClient>, userId: string) {
  const { data, error: queryError } = await client
    .from("participant_achievements")
    .select("achievement_key")
    .eq("participant_id", userId)
    .eq("achievement_key", ACHIEVEMENT_KEY)
    .maybeSingle();
  if (queryError) throw queryError;
  return Boolean(data);
}

function noStore(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return error("Connexion requise.", 401);

  try {
    return noStore({ unlocked: await hasUnlockedTheme(userScopedClient(request), user.id) });
  } catch {
    return error("Le statut du th\u00e8me Wheely est indisponible.", 503);
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return error("Connexion requise.", 401);

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    runToken?: unknown;
    score?: unknown;
    distance?: unknown;
  } | null;

  try {
    const client = userScopedClient(request);
    if (body?.action === "start") {
      if (await hasUnlockedTheme(client, user.id)) return noStore({ unlocked: true });
      const runToken = randomUUID();
      const { error: runError } = await client
        .from("wheely_unlock_runs")
        .upsert(
          { participant_id: user.id, run_id: runToken, started_at: new Date().toISOString() },
          { onConflict: "participant_id" },
        );
      if (runError) throw runError;
      return noStore({
        unlocked: false,
        runToken,
        objective: "Terminer le morceau Wheely en restant sur la piste.",
      });
    }

    if (body?.action !== "complete") return error("Action Wheely invalide.", 400);
    if (await hasUnlockedTheme(client, user.id)) return noStore({ unlocked: true });
    if (typeof body.runToken !== "string" || !UUID_PATTERN.test(body.runToken)) {
      return error("Cette partie Wheely n\u2019est plus valide. Relance le jeu.", 403);
    }

    const { data: run, error: runError } = await client
      .from("wheely_unlock_runs")
      .select("run_id, started_at")
      .eq("participant_id", user.id)
      .eq("run_id", body.runToken)
      .maybeSingle();
    if (runError) throw runError;
    const elapsed = run ? Date.now() - Date.parse(run.started_at) : -1;
    if (!run || elapsed < 0 || elapsed > RUN_TOKEN_TTL_MS) {
      return error("Cette partie Wheely n\u2019est plus valide. Relance le jeu.", 403);
    }
    if (elapsed < MINIMUM_RUN_MS) {
      return error("La face n\u2019est pas encore termin\u00e9e.", 409);
    }

    const score = Number.isFinite(Number(body.score)) ? Math.max(0, Math.floor(Number(body.score))) : 0;
    const distance = Number.isFinite(Number(body.distance)) ? Math.max(0, Math.floor(Number(body.distance))) : 0;
    const { error: insertError } = await client
      .from("participant_achievements")
      .insert({
        participant_id: user.id,
        achievement_key: ACHIEVEMENT_KEY,
        unlocked_at: new Date().toISOString(),
        detail: {
          source: "wheely-audio-ended",
          run_id: body.runToken,
          score,
          distance,
          verified_elapsed_ms: elapsed,
        },
      });
    if (insertError && insertError.code !== "23505") throw insertError;
    if (!(await hasUnlockedTheme(client, user.id))) throw new Error("wheely_unlock_not_persisted");

    return noStore({ unlocked: true, message: "TH\u00c8ME WHEELY D\u00c9BLOQU\u00c9" });
  } catch {
    return error("Le d\u00e9blocage Wheely n\u2019a pas pu \u00eatre enregistr\u00e9.", 503);
  }
}
