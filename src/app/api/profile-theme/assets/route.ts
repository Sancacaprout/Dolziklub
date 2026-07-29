import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { isProfileCustomThemeEditorEnabled } from "@/lib/profile-custom-theme/feature-flag";
import {
  PROFILE_THEME_ASSET_BUCKET,
  PROFILE_THEME_ASSET_INPUT_MAX_BYTES,
  PROFILE_THEME_ASSET_MAX_DIMENSION,
  PROFILE_THEME_ASSET_MAX_PIXELS,
  PROFILE_THEME_ASSET_OUTPUT_MAX_BYTES,
  PROFILE_THEME_ASSET_SIGNED_URL_TTL_SECONDS,
} from "@/lib/profile-custom-theme/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const acceptedMimeTypes = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AssetRow = {
  id: string;
  storage_path: string;
  byte_size: number;
  width: number;
  height: number;
  created_at: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function authenticatedClient(request: Request) {
  const value = request.headers.get("authorization");
  const token = value?.startsWith("Bearer ") ? value.slice(7).trim() : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

async function signedAsset(client: SupabaseClient, row: AssetRow) {
  const { data, error } = await client.storage
    .from(PROFILE_THEME_ASSET_BUCKET)
    .createSignedUrl(row.storage_path, PROFILE_THEME_ASSET_SIGNED_URL_TTL_SECONDS);
  if (error || !data.signedUrl) throw new Error("asset_sign_failed");
  return {
    id: row.id,
    signedUrl: data.signedUrl,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

async function convertToSafeWebp(file: File) {
  const expectedFormat = acceptedMimeTypes.get(file.type);
  if (!expectedFormat || file.size < 1 || file.size > PROFILE_THEME_ASSET_INPUT_MAX_BYTES) {
    throw new Error("asset_input_invalid");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const decoder = sharp(bytes, {
    failOn: "error",
    limitInputPixels: PROFILE_THEME_ASSET_MAX_PIXELS,
    sequentialRead: true,
  });
  const metadata = await decoder.metadata();
  if (
    metadata.format !== expectedFormat ||
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > PROFILE_THEME_ASSET_MAX_PIXELS ||
    metadata.pages && metadata.pages > 1
  ) {
    throw new Error("asset_decode_invalid");
  }

  for (const quality of [86, 74, 62]) {
    const result = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: PROFILE_THEME_ASSET_MAX_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .resize(PROFILE_THEME_ASSET_MAX_DIMENSION, PROFILE_THEME_ASSET_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (
      result.data.byteLength <= PROFILE_THEME_ASSET_OUTPUT_MAX_BYTES &&
      result.info.width <= PROFILE_THEME_ASSET_MAX_DIMENSION &&
      result.info.height <= PROFILE_THEME_ASSET_MAX_DIMENSION
    ) return result;
  }
  throw new Error("asset_output_too_large");
}

export async function GET(request: Request) {
  if (!isProfileCustomThemeEditorEnabled()) return jsonError("Fonction indisponible.", 404);
  const auth = await authenticatedClient(request);
  if (!auth) return jsonError("Connexion requise.", 401);
  const { data, error } = await auth.client
    .from("profile_custom_theme_assets")
    .select("id, storage_path, byte_size, width, height, created_at")
    .order("created_at", { ascending: false });
  if (error) return jsonError("Les images ne peuvent pas être chargées.", 503);
  try {
    const assets = await Promise.all((data as AssetRow[]).map((row) => signedAsset(auth.client, row)));
    return NextResponse.json({ assets });
  } catch {
    return jsonError("Les liens privés ne peuvent pas être créés.", 503);
  }
}

export async function POST(request: Request) {
  if (!isProfileCustomThemeEditorEnabled()) return jsonError("Fonction indisponible.", 404);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > PROFILE_THEME_ASSET_INPUT_MAX_BYTES + 256 * 1024) {
    return jsonError("L’image dépasse 5 Mo.", 413);
  }
  const auth = await authenticatedClient(request);
  if (!auth) return jsonError("Connexion requise.", 401);
  const body = await request.formData().catch(() => null);
  const file = body?.get("file");
  if (!(file instanceof File)) return jsonError("Image manquante.", 400);

  let converted: Awaited<ReturnType<typeof convertToSafeWebp>>;
  try {
    converted = await convertToSafeWebp(file);
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";
    if (code === "asset_output_too_large") return jsonError("L’image reste trop lourde après conversion.", 422);
    return jsonError("Utilise une image JPG, PNG ou WebP valide de 5 Mo maximum.", 422);
  }

  const id = randomUUID();
  const storagePath = `${auth.userId}/${id}.webp`;
  const { error: uploadError } = await auth.client.storage
    .from(PROFILE_THEME_ASSET_BUCKET)
    .upload(storagePath, converted.data, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: false,
    });
  if (uploadError) return jsonError("L’image n’a pas pu être enregistrée.", 503);

  const { data, error: insertError } = await auth.client
    .from("profile_custom_theme_assets")
    .insert({
      id,
      participant_id: auth.userId,
      storage_path: storagePath,
      mime_type: "image/webp",
      byte_size: converted.data.byteLength,
      width: converted.info.width,
      height: converted.info.height,
    })
    .select("id, storage_path, byte_size, width, height, created_at")
    .single();
  if (insertError || !data) {
    await auth.client.storage.from(PROFILE_THEME_ASSET_BUCKET).remove([storagePath]);
    return jsonError("L’image n’a pas pu être référencée.", 503);
  }
  try {
    return NextResponse.json({ asset: await signedAsset(auth.client, data as AssetRow) }, { status: 201 });
  } catch {
    return jsonError("L’image est enregistrée, mais son aperçu privé est indisponible.", 503);
  }
}

export async function DELETE(request: Request) {
  if (!isProfileCustomThemeEditorEnabled()) return jsonError("Fonction indisponible.", 404);
  const auth = await authenticatedClient(request);
  if (!auth) return jsonError("Connexion requise.", 401);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return jsonError("Image invalide.", 400);
  const { data } = await auth.client
    .from("profile_custom_theme_assets")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) return jsonError("Image introuvable.", 404);
  const { error: removeError } = await auth.client.storage
    .from(PROFILE_THEME_ASSET_BUCKET)
    .remove([data.storage_path]);
  if (removeError) return jsonError("L’image ne peut pas être supprimée.", 503);
  const { error: deleteError } = await auth.client
    .from("profile_custom_theme_assets")
    .delete()
    .eq("id", id);
  if (deleteError) return jsonError("Le registre de l’image n’a pas pu être nettoyé.", 503);
  return NextResponse.json({ deleted: true });
}
