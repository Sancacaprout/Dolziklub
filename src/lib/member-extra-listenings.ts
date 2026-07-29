import "server-only";

import { isSameMemberIdentity } from "@/data/members";
import {
  EXTRA_LISTENING_PUBLIC_COLUMNS,
  type ExtraListeningRequest,
} from "@/lib/extra-listenings";
import { getOptionalSupabaseServerReader } from "@/lib/supabase/server-reader";
import { youtubeMusicSearchUrl } from "@/lib/youtube-music";
import type { Album } from "@/types/album";

export type MemberExtraListeningAlbum = {
  album: Album;
  href: string;
  external: boolean;
  sourceLabel: string;
};

function extraAlbum(
  request: ExtraListeningRequest,
  cover: string | null,
): MemberExtraListeningAlbum {
  const albumUrl = request.youtube_music_url ?? request.deezer_url;
  const drawLabel = String(request.draw_number).padStart(2, "0");
  const fallbackHref = `/tableur?extra=${encodeURIComponent(request.id)}`;

  return {
    album: {
      id: `extra-${request.id}`,
      slug: `extra-${request.id}`,
      title: request.album_title ?? "Album en attente",
      artist: request.album_artist ?? "Artiste non renseigné",
      cover,
      releaseYear: null,
      origin: null,
      language: null,
      genres: [],
      projectType: "Écoute supplémentaire",
      proposedBy: request.proposer_display_name,
      listenedBy: request.requester_display_name,
      rating: request.rating,
      shortReview: request.review_title,
      detailedReview: request.review,
      bestTrack: {
        title: request.best_track,
        url: request.best_track
          ? youtubeMusicSearchUrl(
              request.best_track,
              request.album_artist,
              request.album_title,
            )
          : null,
      },
      worstTrack: {
        title: request.worst_track,
        url: request.worst_track
          ? youtubeMusicSearchUrl(
              request.worst_track,
              request.album_artist,
              request.album_title,
            )
          : null,
      },
      albumUrl,
      artistDescription: null,
      albumDescription: null,
      status: request.status === "reviewed" ? "rated" : "pending",
      drawNumber: request.draw_number,
      archiveNumber: null,
    },
    href: albumUrl ?? fallbackHref,
    external: Boolean(albumUrl),
    sourceLabel: `Écoute supplémentaire · Tirage ${drawLabel}`,
  };
}

export async function getMemberExtraListeningAlbums(memberIdentity: string) {
  const reader = getOptionalSupabaseServerReader();
  if (!reader) return { proposed: [], listened: [] };

  const { data, error } = await reader
    .from("extra_listening_requests")
    .select(EXTRA_LISTENING_PUBLIC_COLUMNS)
    .not("album_title", "is", null)
    .not("album_artist", "is", null)
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false });

  if (error) return { proposed: [], listened: [] };

  const requests = (data ?? []) as unknown as ExtraListeningRequest[];
  const toEntry = (request: ExtraListeningRequest) => {
    const cover = request.cover_path
      ? reader.storage.from("album-covers").getPublicUrl(request.cover_path).data.publicUrl
      : request.cover_source_url;
    return extraAlbum(request, cover);
  };

  return {
    proposed: requests
      .filter((request) =>
        isSameMemberIdentity(request.proposer_username, memberIdentity),
      )
      .map(toEntry),
    listened: requests
      .filter((request) =>
        request.status === "reviewed"
        && isSameMemberIdentity(request.requester_username, memberIdentity),
      )
      .map(toEntry),
  };
}
