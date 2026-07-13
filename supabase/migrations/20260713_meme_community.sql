-- Community features for the memes page. Uploads and interactions always belong
-- to the authenticated member who created them.

create table if not exists public.meme_posts (
  id uuid primary key default gen_random_uuid(),
  image_path text not null unique check (char_length(image_path) between 1 and 512),
  caption text check (caption is null or char_length(btrim(caption)) between 1 and 280),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists meme_posts_created_at_idx on public.meme_posts (created_at desc);

create table if not exists public.meme_reactions (
  meme_id text not null check (char_length(meme_id) between 1 and 120),
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (meme_id, user_id)
);

create index if not exists meme_reactions_meme_id_idx on public.meme_reactions (meme_id);

create table if not exists public.meme_comments (
  id uuid primary key default gen_random_uuid(),
  meme_id text not null check (char_length(meme_id) between 1 and 120),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists meme_comments_meme_id_created_at_idx on public.meme_comments (meme_id, created_at);

alter table public.meme_posts enable row level security;
alter table public.meme_reactions enable row level security;
alter table public.meme_comments enable row level security;

revoke all on table public.meme_posts from anon;
revoke all on table public.meme_reactions from anon;
revoke all on table public.meme_comments from anon;
grant select on table public.meme_posts to anon, authenticated;
grant insert, delete on table public.meme_posts to authenticated;
grant select, insert, update, delete on table public.meme_reactions to authenticated;
grant select, insert, delete on table public.meme_comments to authenticated;

create policy "meme posts are visible to everyone"
  on public.meme_posts for select
  using (true);

create policy "members can add their own meme posts"
  on public.meme_posts for insert to authenticated
  with check (
    created_by = auth.uid()
    and image_path like (auth.uid()::text || '/%')
  );

create policy "members can remove their own meme posts"
  on public.meme_posts for delete to authenticated
  using (created_by = auth.uid() or private.is_member_admin());

create policy "members can read meme reactions"
  on public.meme_reactions for select to authenticated
  using (true);

create policy "members can add their own reactions"
  on public.meme_reactions for insert to authenticated
  with check (user_id = auth.uid());

create policy "members can change their own reactions"
  on public.meme_reactions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "members can remove their own reactions"
  on public.meme_reactions for delete to authenticated
  using (user_id = auth.uid());

create policy "members can read meme comments"
  on public.meme_comments for select to authenticated
  using (true);

create policy "members can add their own meme comments"
  on public.meme_comments for insert to authenticated
  with check (author_id = auth.uid());

create policy "members can remove their own meme comments"
  on public.meme_comments for delete to authenticated
  using (author_id = auth.uid() or private.is_member_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meme-uploads',
  'meme-uploads',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "members upload their own meme images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'meme-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "members remove their own meme images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'meme-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
