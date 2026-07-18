import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticatedUser, cleanText, error } from "@/lib/music-server";

function getAuthenticatedSupabase(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) throw new Error("supabase_user_client_unavailable");

  return createClient(url, key, {
    accessToken: async () => token,
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionFor(contentType: string) {
  return contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return error("Connexion requise.", 401);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const drawEntryId = cleanText(form?.get("drawEntryId"), 80);
  const archiveAlbumId = cleanText(form?.get("archiveAlbumId"), 80);
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
    return error("Choisis une image JPG, PNG ou WebP de 5 Mo maximum.", 400);
  }
  if ((!drawEntryId || !/^[0-9a-f-]{36}$/i.test(drawEntryId)) && (!archiveAlbumId || !/^archive-[0-9]+$/i.test(archiveAlbumId))) {
    return error("Album invalide.", 400);
  }

  // The admin's own access token is propagated to Supabase. RLS remains the
  // authorization boundary, so this does not require a service-role key.
  const supabase = getAuthenticatedSupabase(request);
  const { data: profile, error: profileError } = await supabase.from("member_profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) return error("Le statut administrateur n'a pas pu etre verifie.", 503);
  if (profile?.role !== "admin") return error("Acc?s administrateur requis.", 403);

  const target = archiveAlbumId || drawEntryId;
  const path = `${user.id}/editorial/${target}/${Date.now()}.${extensionFor(file.type)}`;
  const { error: uploadError } = await supabase.storage.from("album-covers").upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) return error("La pochette n'a pas pu etre envoyee.", 503);

  if (drawEntryId) {
    const { error: drawError } = await supabase.rpc("admin_set_club_draw_cover", {
      p_entry_id: drawEntryId,
      p_cover_path: path,
    });
    if (drawError) return error("La pochette a ete envoyee, mais le tirage n'a pas pu etre mis a jour.", 503);
  }
  if (archiveAlbumId) {
    const { error: archiveError } = await supabase.from("album_cover_overrides").upsert({ album_id: archiveAlbumId, cover_path: path, updated_by: user.id }, { onConflict: "album_id" });
    if (archiveError) return error("La pochette a ete envoyee, mais l'archive n'a pas pu etre mise a jour.", 503);
  }

  return NextResponse.json({ coverPath: path });
}
