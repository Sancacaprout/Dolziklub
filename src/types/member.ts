export interface Member {
  slug: string;
  displayName: string;
  username: string | null;
  authEmail?: string;
  role: "admin" | "member";
  bio: string | null;
  dataStatus: "confirmed" | "needs-review";
}
