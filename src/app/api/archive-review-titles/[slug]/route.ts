import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getAlbum } from "@/data/albums";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const album = getAlbum((await params).slug);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!album || !url || !key) return NextResponse.json({ review: null });

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await supabase
    .from("archived_album_reviews")
    .select("review_title, review, is_modified")
    .eq("album_id", album.id)
    .maybeSingle();

  if (!data?.is_modified) return NextResponse.json({ review: null });
  return NextResponse.json({ review: { title: data.review_title, text: data.review } });
}
