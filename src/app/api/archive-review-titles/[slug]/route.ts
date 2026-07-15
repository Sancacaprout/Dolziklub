import { NextResponse } from "next/server";

import { getAlbum } from "@/data/albums";
import { getArchivedReviewOverride } from "@/lib/archived-reviews";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const album = getAlbum((await params).slug);
  if (!album) return NextResponse.json({ review: null });

  const override = await getArchivedReviewOverride(album.id).catch(() => null);
  if (!override?.is_modified) return NextResponse.json({ review: null });

  return NextResponse.json({ review: { title: override.review_title ?? null, text: override.review } });
}
