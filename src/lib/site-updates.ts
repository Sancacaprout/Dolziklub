import "server-only";

import {
  siteUpdates,
  updateCategories,
  type SiteUpdate,
  type UpdateCategory,
  type UpdateChange,
  type UpdateLink,
} from "@/data/site-updates";
import { getOptionalSupabaseServerReader } from "@/lib/supabase/server-reader";

type SiteUpdateRow = {
  id: string;
  published_on: string;
  content: unknown;
};

const categorySet = new Set<string>(updateCategories);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readChanges(value: unknown): UpdateChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.text !== "string" || !item.text.trim()) return [];
    const change: UpdateChange = { text: item.text.trim() };
    if (typeof item.href === "string" && item.href.startsWith("/")) {
      change.href = item.href as `/${string}`;
      if (typeof item.linkLabel === "string" && item.linkLabel.trim()) {
        change.linkLabel = item.linkLabel.trim();
      }
    }
    return [change];
  });
}

function readLinks(value: unknown): UpdateLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.label !== "string" ||
      !item.label.trim() ||
      typeof item.href !== "string" ||
      !item.href.startsWith("/")
    ) return [];
    return [{ label: item.label.trim(), href: item.href as `/${string}` }];
  });
}

function readUpdate(row: SiteUpdateRow): SiteUpdate | null {
  if (!isRecord(row.content)) return null;
  const title = typeof row.content.title === "string" ? row.content.title.trim() : "";
  if (!row.id || !title || !/^\d{4}-\d{2}-\d{2}$/.test(row.published_on)) return null;
  const categories = Array.isArray(row.content.categories)
    ? row.content.categories.filter(
        (category): category is UpdateCategory =>
          typeof category === "string" && categorySet.has(category),
      )
    : [];
  return {
    id: row.id,
    version:
      typeof row.content.version === "string" && row.content.version.trim()
        ? row.content.version.trim()
        : undefined,
    date: row.published_on as SiteUpdate["date"],
    title,
    summary:
      typeof row.content.summary === "string" && row.content.summary.trim()
        ? row.content.summary.trim()
        : undefined,
    categories,
    added: readChanges(row.content.added),
    fixed: readChanges(row.content.fixed),
    improved: readChanges(row.content.improved),
    links: readLinks(row.content.links),
  };
}

export async function getSiteUpdates(): Promise<readonly SiteUpdate[]> {
  const supabase = getOptionalSupabaseServerReader();
  if (!supabase) return siteUpdates;
  const { data, error } = await supabase
    .from("site_updates")
    .select("id,published_on,content")
    .order("published_on", { ascending: false })
    .order("display_order", { ascending: true });
  if (error || !data?.length) return siteUpdates;
  const parsed = (data as SiteUpdateRow[]).flatMap((row) => {
    const update = readUpdate(row);
    return update ? [update] : [];
  });
  return parsed.length ? parsed : siteUpdates;
}
