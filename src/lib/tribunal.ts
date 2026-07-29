export type TribunalStatus = "draft" | "open" | "closed" | "results_revealed";
export type TribunalQuestionType = "member" | "member_text" | "album" | "review";

export type TribunalAnswer = {
  id: number;
  targetParticipantId: string | null;
  targetAlbumId: string | null;
  targetReviewId: string | null;
  freeText: string | null;
  isJoker?: boolean;
};

export type TribunalQuestion = {
  id: number;
  position: number;
  prompt: string;
  type: TribunalQuestionType;
  config: { maxLength?: number; placeholder?: string; template?: string };
  isActive: boolean;
  answer: TribunalAnswer | null;
};

export type TribunalSession = {
  id: number;
  title: string;
  status: TribunalStatus;
  opensAt: string | null;
  closesAt: string | null;
  resultsRevealedAt: string | null;
  questionCount: number;
  completedCount: number;
  participantCount: number;
  participationCount: number;
};

export type TribunalSessionSummary = Pick<TribunalSession, "id" | "title" | "status" | "participationCount"> & {
  createdAt: string;
};

export type TribunalParticipant = {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
};

export type TribunalAlbum = {
  id: string;
  title: string;
  artist: string;
  proposedBy: string | null;
  drawNumber: number;
  coverPath: string | null;
  coverSourceUrl: string | null;
};

export type TribunalReview = {
  id: string;
  albumId: string;
  albumTitle: string;
  artist: string;
  memberId: string;
  memberName: string;
  rating: number;
  reviewTitle: string | null;
  reviewExcerpt: string;
  drawNumber: number;
  coverPath: string | null;
  coverSourceUrl: string | null;
};

export type TribunalModerationItem = {
  id: number;
  questionPosition: number;
  questionPrompt: string;
  targetDisplayName: string | null;
  freeText: string;
  isHidden: boolean;
  updatedAt: string;
};

export type TribunalContext = {
  viewerId: string;
  isAdmin: boolean;
  session: TribunalSession | null;
  sessions: TribunalSessionSummary[];
  questions: TribunalQuestion[];
  participants: TribunalParticipant[];
  albums: TribunalAlbum[];
  reviews: TribunalReview[];
  moderation: TribunalModerationItem[];
};

export type TribunalRankingItem = {
  kind: "member" | "album" | "review";
  id: string;
  label: string;
  username?: string;
  artist?: string;
  proposedBy?: string | null;
  memberName?: string;
  rating?: number;
  reviewTitle?: string | null;
  reviewExcerpt?: string;
  drawNumber?: number;
  votes: number;
  percentage: number;
};

export type TribunalQuestionResult = {
  id: number;
  position: number;
  prompt: string;
  type: TribunalQuestionType;
  totalVotes: number;
  ranking: TribunalRankingItem[];
  freeAnswers: Array<{ targetDisplayName: string | null; text: string }>;
};

export type TribunalResults = {
  session: Pick<TribunalSession, "id" | "title" | "status" | "resultsRevealedAt">;
  questions: TribunalQuestionResult[];
  globalRanking: Array<{ id: string; label: string; username: string; citations: number }>;
};

export const tribunalStatusLabels: Record<TribunalStatus, string> = {
  draft: "BROUILLON",
  open: "OUVERT",
  closed: "CLOS",
  results_revealed: "RÉSULTATS RÉVÉLÉS",
};

export const tribunalStampMessages = [
  "C’EST ENREGISTRÉ, LE MAL EST FAIT",
  "UNE BALLE PERDUE DE PLUS",
  "ÇA PART DANS LE DOSSIER",
  "IL NE LE SAIT PAS ENCORE",
  "PERSONNE NE SORTIRA PROPRE",
] as const;
