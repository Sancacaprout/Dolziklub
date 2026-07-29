import { NextResponse } from "next/server";
import {
  isProfileCustomThemeEditorEnabled,
} from "@/lib/profile-custom-theme/feature-flag";
import {
  authenticateProfileThemeRequest,
} from "@/lib/profile-custom-theme/request-auth";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isProfileCustomThemeEditorEnabled()) return jsonError("Fonction indisponible.", 404);
  const auth = await authenticateProfileThemeRequest(request);
  if (!auth) return jsonError("Connexion requise.", 401);
  const body = await request.json().catch(() => null) as { expectedRevision?: unknown } | null;
  const expectedRevision = Number(body?.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    return jsonError("Révision invalide.", 422);
  }

  const { data, error } = await auth.client.rpc("publish_my_profile_custom_theme", {
    expected_revision: expectedRevision,
  });
  if (error) {
    if (error.code === "40001") return jsonError("Le brouillon a été modifié ailleurs. Recharge l’éditeur.", 409);
    if (error.code === "42501") return jsonError("Une image du thème ne t’appartient pas.", 403);
    return jsonError("Le thème n’a pas pu être publié.", 503);
  }
  return NextResponse.json({ published: true, profileTheme: "custom", ...data });
}
