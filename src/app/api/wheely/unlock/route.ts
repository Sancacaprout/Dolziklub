import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { authenticatedUser, error } from "@/lib/music-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ACHIEVEMENT_KEY = "wheely-theme";
const MINIMUM_RUN_MS = 72_000;
const RUN_TOKEN_TTL_MS = 30 * 60_000;

type RunClaim = {
  sub: string;
  iat: number;
  nonce: string;
};

function signingSecret() {
  const secret =
    process.env.WHEELY_UNLOCK_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("wheely_unlock_secret_unavailable");
  return secret;
}

function signature(value: string) {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function createRunToken(userId: string) {
  const claim: RunClaim = { sub: userId, iat: Date.now(), nonce: randomUUID() };
  const payload = Buffer.from(JSON.stringify(claim), "utf8").toString("base64url");
  return `${payload}.${signature(payload)}`;
}

function parseRunToken(value: unknown): RunClaim | null {
  if (typeof value !== "string") return null;
  const [payload, providedSignature, extra] = value.split(".");
  if (!payload || !providedSignature || extra) return null;
  const expectedSignature = signature(payload);
  const provided = Buffer.from(providedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<RunClaim>;
    if (typeof claim.sub !== "string" || typeof claim.iat !== "number" || typeof claim.nonce !== "string") return null;
    return claim as RunClaim;
  } catch {
    return null;
  }
}

async function hasUnlockedTheme(userId: string) {
  // Generated database types are refreshed separately after the remote migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: queryError } = await (getSupabaseAdmin() as any)
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
    return noStore({ unlocked: await hasUnlockedTheme(user.id) });
  } catch {
    return error("Le statut du thème Wheely est indisponible.", 503);
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
    if (body?.action === "start") {
      if (await hasUnlockedTheme(user.id)) return noStore({ unlocked: true });
      return noStore({
        unlocked: false,
        runToken: createRunToken(user.id),
        objective: "Terminer le morceau Wheely en restant sur la piste.",
      });
    }

    if (body?.action !== "complete") return error("Action Wheely invalide.", 400);
    if (await hasUnlockedTheme(user.id)) return noStore({ unlocked: true });

    const claim = parseRunToken(body.runToken);
    const elapsed = claim ? Date.now() - claim.iat : -1;
    if (!claim || claim.sub !== user.id || elapsed < 0 || elapsed > RUN_TOKEN_TTL_MS) {
      return error("Cette partie Wheely n’est plus valide. Relance le jeu.", 403);
    }
    if (elapsed < MINIMUM_RUN_MS) {
      return error("La face n’est pas encore terminée.", 409);
    }

    const score = Number.isFinite(Number(body.score)) ? Math.max(0, Math.floor(Number(body.score))) : 0;
    const distance = Number.isFinite(Number(body.distance)) ? Math.max(0, Math.floor(Number(body.distance))) : 0;
    // Generated database types are refreshed separately after the remote migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (getSupabaseAdmin() as any)
      .from("participant_achievements")
      .upsert(
        {
          participant_id: user.id,
          achievement_key: ACHIEVEMENT_KEY,
          unlocked_at: new Date().toISOString(),
          detail: {
            source: "wheely-audio-ended",
            score,
            distance,
            verified_elapsed_ms: elapsed,
          },
        },
        { onConflict: "participant_id,achievement_key", ignoreDuplicates: true },
      );
    if (insertError) throw insertError;

    return noStore({ unlocked: true, message: "THÈME WHEELY DÉBLOQUÉ" });
  } catch {
    return error("Le déblocage Wheely n’a pas pu être enregistré.", 503);
  }
}