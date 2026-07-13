import { NextResponse } from "next/server";
import { authenticatedUser, cleanText, error, isEntryEditor } from "@/lib/music-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function allowedImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname.endsWith("ytimg.com") || url.hostname.endsWith("ggpht.com"));
  } catch { return false; }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return error("Connexion requise.", 401);
  const body = await request.json().catch(() => null);
  const entryId = cleanText(body?.entryId, 80);
  const imageUrl = cleanText(body?.imageUrl, 1000);
  if (!entryId || !allowedImageUrl(imageUrl)) return error("Pochette invalide.", 400);
  const access = await isEntryEditor(entryId, user.id);
  if (!access.allowed) return error("Cette proposition ne t’appartient pas.", 403);
  if (access.locked && !access.isAdmin) return error("Ces métadonnées ont été verrouillées par un administrateur.", 409);
  try {
    const response = await fetch(imageUrl, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(9000) });
    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (!response.ok || !new Set(["image/jpeg", "image/png", "image/webp"]).has(contentType) || contentLength > 5 * 1024 * 1024) return error("Cette pochette ne peut pas être importée.", 422);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024) return error("Cette pochette est trop volumineuse.", 422);
    const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `auto/${entryId}/cover.${extension}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase: any = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage.from("album-covers").upload(path, bytes, { upsert: true, contentType, cacheControl: "31536000" });
    if (uploadError) throw uploadError;
    const { error: updateError } = await supabase.from("club_draw_entries").update({ cover_path: path, cover_source_url: imageUrl }).eq("id", entryId);
    if (updateError) throw updateError;
    if (access.isAdmin) await supabase.from("music_metadata_audit_log").insert({ entry_id: entryId, actor_id: user.id, event_type: "album_cover_replaced", detail: { source: "youtube" } });
    return NextResponse.json({ coverPath: path });
  } catch {
    return error("La pochette n’a pas pu être importée. Tu peux continuer sans image.", 503);
  }
}
