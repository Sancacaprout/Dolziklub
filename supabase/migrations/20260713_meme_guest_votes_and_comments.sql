-- Public reactions use a browser-scoped UUID. They deliberately do not create
-- Supabase Auth users: voting remains available without an account.

create table if not exists public.meme_guest_reactions (
  meme_id text not null check (char_length(meme_id) between 1 and 120),
  visitor_id uuid not null,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (meme_id, visitor_id)
);

create index if not exists meme_guest_reactions_meme_id_idx on public.meme_guest_reactions (meme_id);
alter table public.meme_guest_reactions enable row level security;

revoke all on table public.meme_reactions from anon;
grant select (meme_id, value, created_at, updated_at) on table public.meme_reactions to anon;

drop policy if exists "members can read meme reactions" on public.meme_reactions;
create policy "public can read reaction totals"
  on public.meme_reactions for select to anon, authenticated
  using (true);

revoke all on table public.meme_guest_reactions from anon, authenticated;
grant select, insert, update, delete on table public.meme_guest_reactions to anon;
grant select on table public.meme_guest_reactions to authenticated;

create policy "public can read guest reactions"
  on public.meme_guest_reactions for select to anon, authenticated
  using (true);

create policy "visitors can add guest reactions"
  on public.meme_guest_reactions for insert to anon
  with check (visitor_id is not null);

create policy "visitors can change guest reactions"
  on public.meme_guest_reactions for update to anon
  using (visitor_id is not null)
  with check (visitor_id is not null);

create policy "visitors can remove guest reactions"
  on public.meme_guest_reactions for delete to anon
  using (visitor_id is not null);

alter table public.meme_comments
  add column if not exists is_anonymous boolean not null default true,
  add column if not exists author_name text;

alter table public.meme_comments
  drop constraint if exists meme_comments_author_mode_check;

alter table public.meme_comments
  add constraint meme_comments_author_mode_check check (
    (is_anonymous and author_name is null)
    or (not is_anonymous and char_length(btrim(author_name)) between 1 and 82)
  );

create or replace function private.prepare_meme_comment_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_anonymous then
    new.author_name := null;
  else
    select '@' || username into new.author_name
    from public.member_profiles
    where id = new.author_id;

    if new.author_name is null then
      raise exception 'A valid member profile is required for a signed comment';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_meme_comment_author() from public, anon, authenticated;

drop trigger if exists prepare_meme_comment_author on public.meme_comments;
create trigger prepare_meme_comment_author
  before insert or update on public.meme_comments
  for each row execute procedure private.prepare_meme_comment_author();

revoke all on table public.meme_comments from anon;
grant select on table public.meme_comments to anon;

drop policy if exists "members can read meme comments" on public.meme_comments;
create policy "public can read meme comments"
  on public.meme_comments for select to anon, authenticated
  using (true);

drop policy if exists "members can add their own meme comments" on public.meme_comments;
create policy "signed members can add their own meme comments"
  on public.meme_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  );
