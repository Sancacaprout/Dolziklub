"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Meme } from "@/types/meme";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type MemePost = {
  id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
};

type MemeReaction = { meme_id: string; user_id: string; value: number };
type MemeComment = { id: string; meme_id: string; body: string; created_at: string };
type DisplayedMeme = Meme & { caption?: string | null };

const permittedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxUploadSize = 5 * 1024 * 1024;

export function MemeGallery({ memes }: { memes: Meme[] }) {
  const configured = isSupabaseConfigured();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [uploadedMemes, setUploadedMemes] = useState<MemePost[]>([]);
  const [reactions, setReactions] = useState<MemeReaction[]>([]);
  const [comments, setComments] = useState<MemeComment[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [commentText, setCommentText] = useState("");

  const displayedMemes = useMemo<DisplayedMeme[]>(() => {
    if (!configured) return memes;
    const remote = uploadedMemes.map((post) => {
      const { data } = getSupabaseBrowserClient().storage.from("meme-uploads").getPublicUrl(post.image_path);
      return { id: `upload-${post.id}`, title: "Mème du Dol Ziklub", src: data.publicUrl, alt: post.caption || "Mème ajouté par un membre du Dol Ziklub", caption: post.caption };
    });
    return [...remote, ...memes];
  }, [configured, memes, uploadedMemes]);

  const activeMeme = displayedMemes.find((meme) => meme.id === activeId) ?? null;

  const loadUploadedMemes = useCallback(async () => {
    if (!configured) return;
    const { data, error } = await getSupabaseBrowserClient()
      .from("meme_posts")
      .select("id, image_path, caption, created_at")
      .order("created_at", { ascending: false });
    if (!error) setUploadedMemes((data ?? []) as MemePost[]);
  }, [configured]);

  const loadSocial = useCallback(async () => {
    if (!configured || !memberId) {
      setReactions([]);
      setComments([]);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const [reactionResult, commentResult] = await Promise.all([
      supabase.from("meme_reactions").select("meme_id, user_id, value"),
      supabase.from("meme_comments").select("id, meme_id, body, created_at").order("created_at", { ascending: true }),
    ]);
    if (!reactionResult.error) setReactions((reactionResult.data ?? []) as MemeReaction[]);
    if (!commentResult.error) setComments((commentResult.data ?? []) as MemeComment[]);
  }, [configured, memberId]);

  useEffect(() => {
    const timer = setTimeout(() => void loadUploadedMemes(), 0);
    return () => clearTimeout(timer);
  }, [loadUploadedMemes]);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    const syncMember = async () => {
      const { data } = await supabase.auth.getUser();
      setMemberId(data.user?.id ?? null);
    };
    void syncMember();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void syncMember());
    return () => listener.subscription.unsubscribe();
  }, [configured]);

  useEffect(() => {
    const timer = setTimeout(() => void loadSocial(), 0);
    return () => clearTimeout(timer);
  }, [loadSocial]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setActiveId(null);
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, []);

  const reactToMeme = async (value: 1 | -1) => {
    if (!memberId || !activeMeme) {
      setMessage("Connecte-toi pour réagir à ce mème.");
      return;
    }
    const existing = reactions.find((reaction) => reaction.meme_id === activeMeme.id);
    const supabase = getSupabaseBrowserClient();
    const result = existing?.value === value
      ? await supabase.from("meme_reactions").delete().eq("meme_id", activeMeme.id).eq("user_id", memberId)
      : await supabase.from("meme_reactions").upsert({ meme_id: activeMeme.id, user_id: memberId, value, updated_at: new Date().toISOString() }, { onConflict: "meme_id,user_id" });
    if (result.error) setMessage("La réaction n’a pas pu être enregistrée.");
    else {
      setMessage("");
      await loadSocial();
    }
  };

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memberId || !activeMeme || !commentText.trim()) return;
    const { error } = await getSupabaseBrowserClient().from("meme_comments").insert({
      meme_id: activeMeme.id,
      author_id: memberId,
      body: commentText.trim(),
    });
    if (error) setMessage("Le message n’a pas pu être ajouté.");
    else {
      setCommentText("");
      setMessage("");
      await loadSocial();
    }
  };

  const uploadMeme = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memberId) return;
    const form = event.currentTarget;
    const file = new FormData(form).get("meme") as File | null;
    const caption = (new FormData(form).get("caption") as string | null)?.trim() || null;
    if (!file || file.size === 0) {
      setMessage("Choisis une image à ajouter.");
      return;
    }
    if (!permittedImageTypes.has(file.type) || file.size > maxUploadSize) {
      setMessage("Choisis une image JPG, PNG, WebP ou GIF de 5 Mo maximum.");
      return;
    }
    setUploading(true);
    setMessage("");
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${memberId}/${crypto.randomUUID()}.${extension}`;
    const supabase = getSupabaseBrowserClient();
    try {
      const { error: storageError } = await supabase.storage.from("meme-uploads").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
      if (storageError) throw storageError;
      const { error: postError } = await supabase.from("meme_posts").insert({ image_path: path, caption, created_by: memberId });
      if (postError) {
        await supabase.storage.from("meme-uploads").remove([path]);
        throw postError;
      }
      form.reset();
      setIsUploadOpen(false);
      setMessage("Mème ajouté au musée.");
      await loadUploadedMemes();
    } catch {
      setMessage("L’ajout du mème n’a pas abouti. Réessaie dans un instant.");
    } finally {
      setUploading(false);
    }
  };

  const activeReactions = activeMeme ? reactions.filter((reaction) => reaction.meme_id === activeMeme.id) : [];
  const activeComments = activeMeme ? comments.filter((comment) => comment.meme_id === activeMeme.id) : [];
  const ownReaction = activeReactions.find((reaction) => reaction.user_id === memberId)?.value;

  return <section className="meme-gallery-section">
    <div className="meme-gallery-actions">
      {memberId ? <button className="button meme-add-button" onClick={() => { setIsUploadOpen((open) => !open); setMessage(""); }}>{isUploadOpen ? "Fermer l’ajout" : "Ajouter un mème ↗"}</button> : <Link className="button meme-add-button" href="/connexion">Connexion pour ajouter ↗</Link>}
    </div>
    {isUploadOpen && <form className="meme-upload" onSubmit={uploadMeme}>
      <label>Image du mème<input name="meme" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required /></label>
      <label>Texte facultatif<textarea name="caption" maxLength={280} placeholder="Une légende pour le musée…" /></label>
      <button className="button" type="submit" disabled={uploading}>{uploading ? "Ajout en cours…" : "Publier le mème"}</button>
    </form>}
    {message && <p className="meme-message" role="status">{message}</p>}
    <div className="meme-grid">{displayedMemes.map((meme) => <button key={meme.id} onClick={() => { setActiveId(meme.id); setMessage(""); }} aria-label={meme.title}><Image src={meme.src} alt={meme.alt} width={600} height={600} sizes="(max-width: 700px) 100vw, 33vw" /></button>)}</div>
    {activeMeme && <div className="lightbox" role="dialog" aria-modal="true" aria-label={activeMeme.title} onMouseDown={() => setActiveId(null)}><div className="lightbox__content" onMouseDown={(event) => event.stopPropagation()}><button className="lightbox__close" onClick={() => setActiveId(null)}>Fermer ×</button><Image src={activeMeme.src} alt={activeMeme.alt} width={1200} height={900} sizes="(max-width: 800px) 94vw, 900px" />{activeMeme.caption && <p className="meme-caption">“{activeMeme.caption}”</p>}<div className="meme-social"><div className="meme-reactions"><button className={ownReaction === 1 ? "active" : ""} onClick={() => void reactToMeme(1)}>↑ J’aime <b>{activeReactions.filter((reaction) => reaction.value === 1).length}</b></button><button className={ownReaction === -1 ? "active" : ""} onClick={() => void reactToMeme(-1)}>↓ Bof <b>{activeReactions.filter((reaction) => reaction.value === -1).length}</b></button></div>{memberId ? <form className="meme-comment-form" onSubmit={addComment}><label>Ajouter un mot au dossier<textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={280} placeholder="Ton commentaire, en une phrase bien sentie…" required /></label><button className="button" type="submit">Publier</button></form> : <p className="meme-login-prompt"><Link href="/connexion">Connecte-toi</Link> pour réagir ou laisser un mot.</p>}{activeComments.length > 0 && <div className="meme-comments">{activeComments.map((comment) => <p key={comment.id}><span>VOIX DU DOL ZIKLUB</span>“{comment.body}”</p>)}</div>}</div></div></div>}
  </section>;
}
