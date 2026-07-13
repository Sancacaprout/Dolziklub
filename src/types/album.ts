export type AlbumStatus = "pending" | "rated" | "archived";

export interface Album {
  id: string;
  slug: string;
  title: string;
  artist: string;
  cover: string | null;
  releaseYear: number | null;
  origin: string | null;
  language: string | null;
  genres: string[];
  projectType: string | null;
  proposedBy: string | null;
  listenedBy: string | null;
  rating: number | null;
  shortReview: string | null;
  detailedReview: string | null;
  bestTrack: { title: string | null; url: string | null };
  worstTrack: { title: string | null; url: string | null };
  albumUrl: string | null;
  artistDescription: string | null;
  albumDescription: string | null;
  status: AlbumStatus;
}
