import { BadgeCollection } from "@/components/auth/badge-collection";

export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<BadgeCollection /></>;
}
