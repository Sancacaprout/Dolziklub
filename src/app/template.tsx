import "./badges.css";
import "./badge-layout.css";
import { BadgeUnlockQueue } from "@/components/badge-unlock-queue";

export default function Template({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><BadgeUnlockQueue />{children}</>;
}
