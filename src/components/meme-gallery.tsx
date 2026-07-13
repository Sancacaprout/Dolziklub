"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Meme } from "@/types/meme";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type MemePost = { id: string; image_path: string; caption: string | null; created_at: string };
type MemberReaction = { meme_id: string; user_id?: string; value: number };
type GuestReaction = { meme_id: string; visitor_id: string; value: number };
type MemeComment = { id: string; meme_id: string; body: string; created_at: string; is_anonymous: boolean; author_name: string | null };
type DisplayedMeme = Meme & { caption?: string | null };

const permittedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxUploadSize = 5 * 1024 * 1024;
const visitorStorageKey = "dol-ziklub-meme-visitor";

function getVisitorId() {
  const existing = localStorage.getItem(visitorStorageKey);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(visitorStorageKey, id);
  return id;
}

function ThumbIcon({ down = false }: { down?: boolean }) {
  const path = "M7 10v12H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3m0 0 4-8h3a2 2 0 0 1 2 2v5h3a3 3 0 0 1 2.88 3.88l-2 7A3 3 0 0 1 17 22H7";
  return <svg className={`meme-thumb meme-thumb--${down ? "down" : "up"}`} viewBox="0 0 24 24" aria-hidden="true"><path d={path} transform={down ? "rotate(180 12 12)" : undefined} /></svg>;
}

function ReactionButtons({ likes, dislikes, ownReaction, onReact, compact = false }: { likes: number; dislikes: number; ownReaction?: number; onReact: (value: 1 | -1) => void; compact?: boolean }) {
  return <div className={compact ? "meme-reactions meme-reactions--compact" : "meme-reactions"}><button className={`meme-reaction-button meme-reaction-button--like ${ownReaction === 1 ? "active" : ""}`} onClick={() => onReact(1)} aria-pressed={ownReaction === 1}><ThumbIcon />{compact ? <b>{likes}</b> : <>J’aime <b>{likes}</b></>}</button><button className={`meme-reaction-button meme-reaction-button--dislike ${ownReaction === -1 ? "active" : ""}`} onClick={() => onReact(-1)} aria-pressed={ownReaction === -1}><ThumbIcon down />{compact ? <b>{dislikes}</b> : <>Bof <b>{dislikes}</b></>}</button></div>;
}

export function MemeGallery({ memes }: { memes: Meme[] }) {
  const configured = isSupabaseConfigured();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [uploadedMemes, setUploadedMemes] = useState<MemePost[]>([]);
  const [memberReactions, setMemberReactions] = useState<MemberReaction[]>([]);
  const [guestReactions, setGuestReactions] = useState<GuestReaction[]>([]);
  const [comments, setComments] = useState<MemeComment[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [commentText, setCommentText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);

  const displayedMemes = useMemo<DisplayedMeme[]>(() => {
    if (!configured) return memes;
    const remote = uploadedMemes.map((post) => {
      const { data } = getSupabaseBrowserClient().storage.from("meme-uploads").getPublicUrl(post.image_path);
      return { id: `upload-${post.id}`, title: "Mème du Dol Ziklub", src: data.publicUrl, alt: post.caption || "Mème ajouté par un membre du Dol Ziklub", caption: post.caption };
    });
    return [...remote, ...memes];
  }, [configured, memes, uploadedMemes]);

  const activeMeme = displayedMemes.find((meme) => meme.id === activeId) ?? null;
  const reactionSummary = (memeId: string) => {
    const reactions = [...memberReactions, ...guestReactions].filter((reaction) => reaction.meme_id === memeId);
    return { likes: reactions.filter((reaction) => reaction.value === 1).length, dislikes: reactions.filter((reaction) => reaction.value === -1).length, own: memberId ? memberReactions.find((reaction) => reaction.meme_id === memeId && reaction.user_id === memberId)?.value : guestReactions.find((reaction) => reaction.meme_id === memeId && reaction.visitor_id === visitorId)?.value };
  };

  const loadUploadedMemes = useCallback(async () => {
    if (!configured) return;
    const { data, error } = await getSupabaseBrowserClient().from("meme_posts").select("id, image_path, caption, created_at").order("created_at", { ascending: false });
    if (!error) setUploadedMemes((data ?? []) as MemePost[]);
  }, [configured]);

  const loadSocial = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    const memberColumns = memberId ? "meme_id, user_id, value" : "meme_id, value";
    const [memberResult, guestResult, commentResult] = await Promise.all([
      supabase.from("meme_reactions").select(memberColumns),
      supabase.from("meme_guest_reactions").select("meme_id, visitor_id, value"),
      supabase.from("meme_comments").select("id, meme_id, body, created_at, is_anonymous, author_name").order("created_at", { ascending: true }),
    ]);
    if (!memberResult.error) setMemberReactions((memberResult.data ?? []) as MemberReaction[]);
    if (!guestResult.error) setGuestReactions((guestResult.data ?? []) as GuestReaction[]);
    if (!commentResult.error) setComments((commentResult.data ?? []) as MemeComment[]);
  }, [configured, memberId]);

  useEffect(() => { const timer = setTimeout(() => setVisitorId(getVisitorId()), 0); return () => clearTimeout(timer); }, []);
  useEffect(() => { const timer = setTimeout(() => void loadUploadedMemes(), 0); return () => clearTimeout(timer); }, [loadUploadedMemes]);
  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    const syncMember = async () => { const { data } = await supabase.auth.getUser(); setMemberId(data.user?.id ?? null); };
    void syncMember();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void syncMember());
    return () => listener.subscription.unsubscribe();
  }, [configured]);
  useEffect(() => { const timer = setTimeout(() => void loadSocial(), 0); return () => clearTimeout(timer); }, [loadSocial]);
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === "Escape" && setActiveId(null); addEventListener("keydown", close); return () => removeEventListener("keydown", close); }, []);

  const reactToMeme = async (memeId: string, value: 1 | -1) => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    const summary = reactionSummary(memeId);
    const identity = memberId ?? visitorId ?? getVisitorId();
    if (!visitorId && !memberId) setVisitorId(identity);
    const table = memberId ? "meme_reactions" : "meme_guest_reactions";
    const identityColumn = memberId ? "user_id" : "visitor_id";
    const existing = summary.own;
    const result = existing === value
      ? await supabase.from(table).delete().eq("meme_id", memeId).eq(identityColumn, identity)
      : await supabase.from(table).upsert({ meme_id: memeId, [identityColumn]: identity, value, updated_at: new Date().toISOString() }, { onConflict: `meme_id,${identityColumn}` });
    if (result.error) setMessage("La réaction n’a pas pu être enregistrée.");
    else { setMessage(""); await loadSocial(); }
  };

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memberId || !activeMeme || !commentText.trim()) return;
    const { error } = await getSupabaseBrowserClient().from("meme_comments").insert({ meme_id: activeMeme.id, author_id: memberId, body: commentText.trim(), is_anonymous: isAnonymous });
    if (error) setMessage("Le message n’a pas pu être ajouté.");
    else { setCommentText(""); setMessage(""); await loadSocial(); }
  };

  const uploadMeme = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memberId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("meme") as File | null;
    const caption = (formData.get("caption") as string | null)?.trim() || null;
    if (!file || file.size === 0) { setMessage("Choisis une image à ajouter."); return; }
    if (!permittedImageTypes.has(file.type) || file.size > maxUploadSize) { setMessage("Choisis une image JPG, PNG, WebP ou GIF de 5 Mo maximum."); return; }
    setUploading(true); setMessage("");
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${memberId}/${crypto.randomUUID()}.${extension}`;
    const supabase = getSupabaseBrowserClient();
    try {
      const { error: storageError } = await supabase.storage.from("meme-uploads").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
      if (storageError) throw storageError;
      const { error: postError } = await supabase.from("meme_posts").insert({ image_path: path, caption, created_by: memberId });
      if (postError) { await supabase.storage.from("meme-uploads").remove([path]); throw postError; }
      form.reset(); setIsUploadOpen(false); setMessage("Mème ajouté au musée."); await loadUploadedMemes();
    } catch { setMessage("L’ajout du mème n’a pas abouti. Réessaie dans un instant."); }
    finally { setUploading(false); }
  };

  const activeComments = activeMeme ? comments.filter((comment) => comment.meme_id === activeMeme.id) : [];

  return <section className="meme-gallery-section"><div className="meme-gallery-actions">{memberId ? <button className="button meme-add-button" onClick={() => { setIsUploadOpen((open) => !open); setMessage(""); }}>{isUploadOpen ? "Fermer l’ajout" : "Ajouter un mème ↗"}</button> : <Link className="button meme-add-button" href="/connexion">Connexion pour ajouter ↗</Link>}</div>{isUploadOpen && <form className="meme-upload" onSubmit={uploadMeme}><label>Image du mème<input name="meme" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required /></label><label>Texte facultatif<textarea name="caption" maxLength={280} placeholder="Une légende pour le musée…" /></label><button className="button" type="submit" disabled={uploading}>{uploading ? "Ajout en cours…" : "Publier le mème"}</button></form>}{message && <p className="meme-message" role="status">{message}</p>}<div className="meme-grid">{displayedMemes.map((meme) => { const summary = reactionSummary(meme.id); return <div className="meme-tile" key={meme.id}><button className="meme-tile__image" onClick={() => { setActiveId(meme.id); setMessage(""); }} aria-label={meme.title}><Image src={meme.src} alt={meme.alt} width={600} height={600} sizes="(max-width: 700px) 100vw, 33vw" /></button><ReactionButtons compact likes={summary.likes} dislikes={summary.dislikes} ownReaction={summary.own} onReact={(value) => void reactToMeme(meme.id, value)} /></div>; })}</div>{activeMeme && (() => { const summary = reactionSummary(activeMeme.id); return <div className="lightbox" role="dialog" aria-modal="true" aria-label={activeMeme.title} onMouseDown={() => setActiveId(null)}><div className="lightbox__content" onMouseDown={(event) => event.stopPropagation()}><button className="lightbox__close" onClick={() => setActiveId(null)}>Fermer ×</button><Image src={activeMeme.src} alt={activeMeme.alt} width={1200} height={900} sizes="(max-width: 800px) 94vw, 900px" />{activeMeme.caption && <p className="meme-caption">“{activeMeme.caption}”</p>}<div className="meme-social"><ReactionButtons likes={summary.likes} dislikes={summary.dislikes} ownReaction={summary.own} onReact={(value) => void reactToMeme(activeMeme.id, value)} />{memberId ? <form className="meme-comment-form" onSubmit={addComment}><label>Ajouter un mot au dossier<textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={280} placeholder="Ton commentaire, en une phrase bien sentie…" required /></label><label className="meme-anonymous-control"><input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} />Mode anonyme</label><button className="button" type="submit">Publier</button></form> : <p className="meme-login-prompt"><Link href="/connexion">Connecte-toi</Link> pour laisser un commentaire.</p>}{activeComments.length > 0 && <div className="meme-comments">{activeComments.map((comment) => <p key={comment.id}><span>{comment.is_anonymous ? "ANONYME" : comment.author_name}</span>“{comment.body}”</p>)}</div>}</div></div></div>; })()}</section>;
}
