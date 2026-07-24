import type { Album } from "@/types/album";

// These archive numbers are already persisted in Supabase. They keep the
// catalogue readable if PostgREST temporarily serves its pre-migration schema.
const liveArchiveNumbers: Record<string, number> = {
  "e6d0888c-e1f9-454a-83d9-734e799a8606": 46,
  "6a384c88-24ce-4924-906f-9e361efb207b": 47,
  "db4da781-9d1f-4f2d-b7a7-5ca153883489": 48,
  "90ea6759-0b2a-4bc2-90e3-96bccf73bd29": 49,
  "8594a435-820d-4c8b-88dc-34de47747062": 50,
  "b408bd5d-27f4-45e6-827a-6b3816d32312": 51,
  "9ea6c113-5687-4dd7-8eef-150252b756ed": 52,
  "d98caa7b-0363-4f45-abfe-59f253283a6f": 53,
  "79016df7-ebe4-4aff-a67c-220f6ba6fb02": 54,
  "3982fd84-dc2d-477d-9b76-6bb83c52e50a": 55,
  "4c73abac-d18f-4a1d-b119-b2a021965e3f": 56,
  "cea00e39-73d6-4670-8619-7432906bcc4f": 57,
  "ddebc411-d5e5-4c69-87a6-dd7f36cbc0d2": 58,
  "d57d322d-c612-496b-9d11-de744238b0bd": 59,
  "af549b87-de0e-49f8-8d3e-ea706676b622": 60,
  "4aa756e9-12de-4fb1-850f-b2545dfdc161": 61,
  "dc97a74f-4343-4c4c-abc4-c49f16c94cbb": 62,
  "fe704b4f-a58b-4006-a55f-27e4042843dc": 63,
  "1f22b720-beed-47dc-add6-d3d4b9195e05": 64,
};

export function resolvedArchiveNumber(album: Album): number | null {
  if (album.archiveNumber != null) return album.archiveNumber;
  if (album.id.startsWith("archive-")) return Number(album.id.replace("archive-", ""));
  const liveId = album.id.startsWith("live-") ? album.id.slice(5) : album.liveEntryId;
  return liveId ? liveArchiveNumbers[liveId] ?? null : null;
}