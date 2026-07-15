import type { ReactNode } from "react";

import { ArchiveReviewSynchronizer } from "@/components/archive-review-synchronizer";

export default async function AlbumLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = (await params) ?? {};
  return (
    <>
      {children}
      {slug && <ArchiveReviewSynchronizer slug={slug} />}
    </>
  );
}
