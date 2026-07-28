export type ExtraListeningStatus =
  | "pending_proposal"
  | "album_proposed"
  | "listening"
  | "reviewed"
  | "cancelled";

export type ExtraListeningRequest = {
  id: string;
  draw_number: number;
  requester_username: string;
  requester_display_name: string;
  proposer_username: string;
  proposer_display_name: string;
  message?: string | null;
  status: ExtraListeningStatus;
  album_title: string | null;
  album_artist: string | null;
  cover_path: string | null;
  cover_source_url: string | null;
  deezer_url: string | null;
  youtube_music_url: string | null;
  review_title: string | null;
  review: string | null;
  rating: number | null;
  best_track: string | null;
  worst_track: string | null;
  requested_at: string;
  proposed_at: string | null;
  reviewed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
};

export const EXTRA_LISTENING_PUBLIC_COLUMNS = [
  "id",
  "draw_number",
  "requester_username",
  "requester_display_name",
  "proposer_username",
  "proposer_display_name",
  "status",
  "album_title",
  "album_artist",
  "cover_path",
  "cover_source_url",
  "deezer_url",
  "youtube_music_url",
  "review_title",
  "review",
  "rating",
  "best_track",
  "worst_track",
  "requested_at",
  "proposed_at",
  "reviewed_at",
  "cancelled_at",
  "updated_at",
].join(", ");

export const extraListeningStatusLabels: Record<ExtraListeningStatus, string> = {
  pending_proposal: "En attente de proposition",
  album_proposed: "Album proposé",
  listening: "En cours d’écoute",
  reviewed: "Écouté et évalué",
  cancelled: "Annulée",
};

export function isExtraListeningActive(status: ExtraListeningStatus) {
  return status === "pending_proposal" || status === "album_proposed" || status === "listening";
}

export function isSameMember(username: string | null | undefined, memberUsername: string | null | undefined) {
  return username?.trim().toLocaleLowerCase() === memberUsername?.trim().toLocaleLowerCase();
}
