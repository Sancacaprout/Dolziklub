import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdminAccess } from "@/lib/admin-access";
import { AdminMemberList } from "./admin-member-list";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Administration — DOL ZIKLUB",
  robots: { index: false, follow: false },
};

type VerifiedAccess = Extract<Awaited<ReturnType<typeof getAdminAccess>>, { status: "admin" }>;

async function MemberDirectory({ access }: { access: VerifiedAccess }) {
  const { client, actorId } = access;
  const { data: profiles, error } = await client.from("member_profiles").select("id, username, display_name, role");
  if (error || !profiles?.some((profile) => profile.id === actorId && profile.role === "admin")) {
    return <p role="alert">Le répertoire n’a pas pu être chargé. Recharge la page pour réessayer.</p>;
  }
  const { data: avatars } = await client.from("member_public_profiles")
    .select("id, avatar_path")
    .in("id", profiles.map((profile) => profile.id));
  const avatarPaths = new Map((avatars ?? []).map((avatar) => [avatar.id, avatar.avatar_path]));

  return <AdminMemberList members={profiles.map((profile) => {
    const avatarPath = avatarPaths.get(profile.id);
    return {
      username: profile.username,
      name: profile.display_name,
      role: profile.role,
      avatarUrl: avatarPath ? client.storage.from("member-avatars").getPublicUrl(avatarPath).data.publicUrl : null,
    };
  })} />;
}

export default async function AdminPage() {
  const access = await getAdminAccess();
  if (access.status === "signed-out") redirect("/connexion");
  if (access.status === "forbidden") notFound();
  if (access.status !== "admin") {
    return <main className="page"><h1>Accès indisponible</h1><p role="alert">La vérification de ton accès a échoué. Recharge la page pour réessayer.</p></main>;
  }

  return <main className={`page ${styles.page}`}>
    <header className={styles.heading}>
      <p className="eyebrow">ESPACE PRIVÉ</p>
      <h1>Administration <em>du club.</em></h1>
    </header>
    <section className={styles.panel} aria-labelledby="member-assistance-title">
      <h2 id="member-assistance-title">Assistance compte membre</h2>
      <p id="member-assistance-status" className={styles.notice}>Le mode assistance est désactivé. Le répertoire est consultable par les administrateurs.</p>
      <Suspense fallback={<p role="status">Chargement des membres…</p>}>
        <MemberDirectory access={access} />
      </Suspense>
    </section>
  </main>;
}
