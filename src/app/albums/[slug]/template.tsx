import type { ReactNode } from "react";

import { ArchiveReviewTitleSynchronizer } from "@/components/archive-review-title-synchronizer";

export default async function AlbumTemplate({
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
      {slug && <ArchiveReviewTitleSynchronizer slug={slug} />}
    </>
  );
}
