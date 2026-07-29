import { NextResponse } from "next/server";
import {
  isProfileCustomThemeEditorEnabled,
} from "@/lib/profile-custom-theme/feature-flag";
import {
  authenticateProfileThemeRequest,
} from "@/lib/profile-custom-theme/request-auth";
import {
  validateProfileCustomThemeConfig,
} from "@/lib/profile-custom-theme/validator";

export const dynamic = "force-dynamic";

type ThemeRow = {
  config: unknown;
  revision: number;
  updated_at?: string;
  published_at?: string;
  tutorial_completed_at?: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function conflictStatus(code: string | undefined) {
  return code === "40001" ? 409 : 503;
}

export async function GET(request: Request) {
  if (!isProfileCustomThemeEditorEnabled()) return jsonError("Fonction indisponible.", 404);
  const auth = await authenticateProfileThemeRequest(request);
  if (!auth) return jsonError("Connexion requise.", 401);

  const [draftResult, publicationResult] = await Promise.all([
    auth.client
      .from("profile_custom_theme_drafts")
      .select("config, revision, updated_at, tutorial_completed_at")
      .eq("participant_id", auth.userId)
      .maybeSingle(),
    auth.client
      .from("profile_custom_theme_publications")
      .select("config, revision, published_at")
      .eq("participant_id", auth.userId)
      .maybeSingle(),
  ]);
  if (draftResult.error || publicationResult.error) {
    return jsonError("Le brouillon ne peut pas être chargé.", 503);
  }

  const draft = draftResult.data as ThemeRow | null;
  const publication = publicationResult.data as ThemeRow | null;
  const validatedDraft = draft
    ? validateProfileCustomThemeConfig(draft.config)
    : null;
  const validatedPublication = publication
    ? validateProfileCustomThemeConfig(publication.config)
    : null;
  if (validatedDraft && !validatedDraft.ok || validatedPublication && !validatedPublication.ok) {
    return jsonError("La configuration enregistrée est invalide.", 503);
  }

  const status = !draft && !publication
    ? "never"
    : draft && !publication
      ? "draft"
      : draft && publication && draft.revision > publication.revision
        ? "changes"
        : "published";

  return NextResponse.json({
    status,
    draft: draft && validatedDraft?.ok ? {
      config: validatedDraft.value,
      revision: draft.revision,
      updatedAt: draft.updated_at,
      tutorialCompleted: Boolean(draft.tutorial_completed_at),
    } : null,
    publication: publication && validatedPublication?.ok ? {
      config: validatedPublication.value,
      revision: publication.revision,
      publishedAt: publication.published_at,
    } : null,
  });
}

export async function POST(request: Request) {
  if (!isProfileCustomThemeEditorEnabled()) return jsonError("Fonction indisponible.", 404);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 96 * 1024) return jsonError("Le brouillon est trop volumineux.", 413);
  const auth = await authenticateProfileThemeRequest(request);
  if (!auth) return jsonError("Connexion requise.", 401);
  const body = await request.json().catch(() => null) as {
    config?: unknown;
    expectedRevision?: unknown;
    tutorialCompleted?: unknown;
  } | null;
  const validation = validateProfileCustomThemeConfig(body?.config);
  const expectedRevision = Number(body?.expectedRevision);
  if (!validation.ok || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return jsonError("Brouillon invalide.", 422);
  }

  const { data, error } = await auth.client.rpc("save_my_profile_custom_theme_draft", {
    p_config: validation.value,
    p_expected_revision: expectedRevision,
    p_tutorial_completed: body?.tutorialCompleted === true,
  });
  if (error) {
    const status = conflictStatus(error.code);
    return jsonError(status === 409 ? "Le brouillon a été modifié ailleurs. Recharge l’éditeur." : "Le brouillon n’a pas pu être enregistré.", status);
  }
  return NextResponse.json({ saved: true, ...data });
}

export async function DELETE(request: Request) {
  if (!isProfileCustomThemeEditorEnabled()) return jsonError("Fonction indisponible.", 404);
  const auth = await authenticateProfileThemeRequest(request);
  if (!auth) return jsonError("Connexion requise.", 401);
  const expectedRevision = Number(new URL(request.url).searchParams.get("expectedRevision"));
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return jsonError("Révision invalide.", 422);
  }
  const { data, error } = await auth.client.rpc("reset_my_profile_custom_theme_draft", {
    p_expected_revision: expectedRevision,
  });
  if (error) {
    const status = conflictStatus(error.code);
    return jsonError(status === 409 ? "Le brouillon a été modifié ailleurs." : "Les modifications ne peuvent pas être annulées.", status);
  }
  const validation = validateProfileCustomThemeConfig(data?.config);
  if (!validation.ok) return jsonError("La configuration restaurée est invalide.", 503);
  return NextResponse.json({
    reset: true,
    config: validation.value,
    revision: Number(data?.revision ?? 0),
    publishedRevision: data?.publishedRevision == null ? null : Number(data.publishedRevision),
  });
}
