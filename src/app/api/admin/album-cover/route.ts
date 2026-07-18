import { NextResponse } from "next/server";
import { authenticatedUser, cleanText, error } from "@/lib/music-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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

  // This route, not the browser, performs the upload. It keeps the storage
  // bucket public for reading while making the administrative mutation private.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = getSupabaseAdmin();
  const { data: profile } = await supabase.from("member_profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return error("Acc?s administrateur requis.", 403);

  const target = archiveAlbumId || drawEntryId;
  const path = `editorial/${target}/${Date.now()}.${extensionFor(file.type)}`;
  const { error: uploadError } = await supabase.storage.from("album-covers").upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) return error("La pochette n'a pas pu etre envoyee.", 503);

  if (drawEntryId) {
    const { error: drawError } = await supabase.from("club_draw_entries").update({ cover_path: path, cover_source_url: null }).eq("id", drawEntryId);
    if (drawError) return error("La pochette a ete envoyee, mais le tirage n'a pas pu etre mis a jour.", 503);
  }
  if (archiveAlbumId) {
    const { error: archiveError } = await supabase.from("album_cover_overrides").upsert({ album_id: archiveAlbumId, cover_path: path, updated_by: user.id }, { onConflict: "album_id" });
    if (archiveError) return error("La pochette a ete envoyee, mais l'archive n'a pas pu etre mise a jour.", 503);
  }

  return NextResponse.json({ coverPath: path });
}
