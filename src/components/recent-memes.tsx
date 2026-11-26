import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { MemeCommentCount } from "@/components/meme-comment-count";

type RecentMeme = { id: string; image_path: string; caption: string | null; comment_count: number };

export async function getRecentMemes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const client = url && key ? createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, options) => fetch(input, { ...options, cache: "no-store" }) },
  }) : null;
  if (!client) return { posts: [], unavailable: true };
  const { data, error } = await client.rpc("recent_published_memes");
  const posts = ((data ?? []) as RecentMeme[]).map((post) => ({
    id: post.id,
    caption: post.caption,
    commentCount: post.comment_count,
    imageUrl: client.storage.from("meme-uploads").getPublicUrl(post.image_path).data.publicUrl,
  }));
  return { posts, unavailable: Boolean(error) };
}

export function RecentMemes({ posts, unavailable }: Awaited<ReturnType<typeof getRecentMemes>>) {
  return <section className="section meme-preview">
    <div className="section-heading">
      <h2>Derniers mèmes</h2>
      <Link href="/memes" prefetch={false}>Tous les mèmes →</Link>
    </div>
    {posts.length ? <div className="meme-strip">{posts.map((post) => {
      const href = `/memes?meme=upload-${post.id}`;
      return <article key={post.id}>
        <Link href={href} aria-label={post.caption || "Ouvrir le mème"} prefetch={false}>
          <Image src={post.imageUrl} alt={post.caption || "Mème du DOL ZIKLUB"} width={500} height={500} sizes="(max-width: 700px) 45vw, 25vw" />
        </Link>
        <Link className="meme-comment-count" href={`${href}&comments=1`} prefetch={false}><MemeCommentCount count={post.commentCount} /></Link>
      </article>;
    })}</div> : <p>{unavailable ? "Les derniers mèmes sont momentanément indisponibles." : "Aucun mème publié pour le moment."}</p>}
  </section>;
}
