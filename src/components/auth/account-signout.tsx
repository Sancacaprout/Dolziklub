"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AccountSignOut() {
  const router = useRouter();
  return (
    <div className="account-signout-row">
      <button
        className="text-link account-signout"
        type="button"
        onClick={async () => {
          await getSupabaseBrowserClient().auth.signOut();
          router.push("/connexion");
          router.refresh();
        }}
      >
        Se déconnecter
      </button>
    </div>
  );
}
