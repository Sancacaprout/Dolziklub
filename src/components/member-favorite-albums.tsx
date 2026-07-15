"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Favorite = {
  id: string;
  title: string;
  artist_name: string;
  cover_path: string | null;
  cover_source_url: string | null;
  display_order: number;
};

function coverUrl(favorite: Favorite) {
  if (favorite.cover_path) return getSupabaseBrowserClient().storage.from("profile-favorites").getPublicUrl(favorite.cover_path).data.publicUrl;
  return favorite.cover_source_url;
}

export function MemberFavoriteAlbums({ username }: { username: string | null }) {
  const configured = isSupabaseConfigured();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loaded, setLoaded] = useState(!configured || !username);

  useEffect(() => {
    if (!configured || !username) return;
    const supabase = getSupabaseBrowserClient();
    const load = async () => {
      const { data: profile } = await supabase.from("member_public_profiles").select("id").eq("username", username).maybeSingle();
      if (!profile?.id) {
        setLoaded(true);
        return;
      }
      const { data } = await supabase.from("profile_favorite_albums").select("id,title,artist_name,cover_path,cover_source_url,display_order").eq("participant_id", profile.id).order("display_order");
      setFavorites((data ?? []) as Favorite[]);
      setLoaded(true);
    };
    void load();
    const channel = supabase.channel(`member-favorites-${username}`).on("postgres_changes", { event: "*", schema: "public", table: "profile_favorite_albums" }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [configured, username]);

  if (!loaded) return null;
  return (
    <section className="profile-favorites" aria-labelledby="favorite-albums-heading">
      <div className="member-archive__heading"><div><p className="eyebrow">COLLECTION PERSONNELLE</p><h2 id="favorite-albums-heading">Mes 3 albums préférés</h2></div></div>
      {favorites.length ? <div className="profile-favorites__grid">{favorites.map((favorite) => {
        const cover = coverUrl(favorite);
        return <article className="profile-favorite-card" key={favorite.id}>
          <div className="profile-favorite-card__cover">{cover ? <img src={cover} alt={`Jaquette de ${favorite.title} par ${favorite.artist_name}`} /> : <span aria-hidden="true">DOL<br />ZIKLUB</span>}</div>
          <h3>{favorite.title}</h3><p>{favorite.artist_name}</p>
        </article>;
      })}</div> : <p className="profile-favorites__empty">Aucun album favori renseigné pour le moment.</p>}
    </section>
  );
}
