-- A durable, account-scoped inbox.  Notifications are created by database
-- triggers so they are never lost when a member is away from the site.
create table if not exists public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('meme', 'album', 'review', 'draw')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 360),
  href text not null check (href like '/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists member_notifications_recipient_created_idx
  on public.member_notifications (recipient_id, created_at desc);

alter table public.member_notifications enable row level security;
revoke all on table public.member_notifications from anon, authenticated;
grant select, update, delete on table public.member_notifications to authenticated;

drop policy if exists "Members can read their own notifications" on public.member_notifications;
create policy "Members can read their own notifications"
  on public.member_notifications for select to authenticated
  using ((select auth.uid()) = recipient_id);

drop policy if exists "Members can mark their own notifications" on public.member_notifications;
create policy "Members can mark their own notifications"
  on public.member_notifications for update to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

drop policy if exists "Members can delete their own notifications" on public.member_notifications;
create policy "Members can delete their own notifications"
  on public.member_notifications for delete to authenticated
  using ((select auth.uid()) = recipient_id);

create or replace function private.add_member_notification(
  p_recipient_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_href text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_recipient_id is null then return; end if;
  insert into public.member_notifications (recipient_id, kind, title, body, href)
  values (p_recipient_id, p_kind, p_title, p_body, p_href);
end;
$$;

revoke all on function private.add_member_notification(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function private.notify_new_meme()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.member_notifications (recipient_id, kind, title, body, href)
  select profile.id, 'meme', 'Nouveau mème au musée', 'Un membre vient de publier un nouveau mème.', '/memes'
  from public.member_profiles as profile
  where profile.id <> new.created_by;
  return new;
end;
$$;

create or replace function private.notify_album_given()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.listened_by is not null
     and new.proposed_by is distinct from new.listened_by
     and (old.album_title is null or old.album_artist is null)
     and new.album_title is not null
     and new.album_artist is not null then
    perform private.add_member_notification(
      new.listened_by,
      'album',
      'Nouvel album à écouter',
      coalesce(new.proposed_by_name, 'Un membre') || ' t’a donné « ' || new.album_title || ' » de ' || new.album_artist || '.',
      '/tableur'
    );
  end if;
  return new;
end;
$$;

create or replace function private.notify_review_published()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  entry public.club_draw_entries%rowtype;
  reviewer_name text;
begin
  select * into entry from public.club_draw_entries where id::text = new.album_id;
  if found and entry.proposed_by is not null and entry.proposed_by <> new.member_id then
    select username into reviewer_name from public.member_profiles where id = new.member_id;
    perform private.add_member_notification(
      entry.proposed_by,
      'review',
      'Un avis est arrivé',
      coalesce(reviewer_name, entry.listened_by_name, 'Ton binôme') || ' a donné son avis sur « ' || coalesce(entry.album_title, 'ton album') || ' ».',
      '/tableur'
    );
  end if;
  return new;
end;
$$;

create or replace function private.notify_draw_published()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.member_notifications (recipient_id, kind, title, body, href)
    select profile.id, 'draw', 'Nouveau tirage publié', 'Le tirage #' || new.draw_number || ' est prêt : découvre ton binôme.', '/tableur'
    from public.member_profiles as profile;
  end if;
  return new;
end;
$$;

revoke all on function private.notify_new_meme() from public, anon, authenticated;
revoke all on function private.notify_album_given() from public, anon, authenticated;
revoke all on function private.notify_review_published() from public, anon, authenticated;
revoke all on function private.notify_draw_published() from public, anon, authenticated;

drop trigger if exists meme_posts_notify_members on public.meme_posts;
create trigger meme_posts_notify_members
  after insert on public.meme_posts
  for each row execute function private.notify_new_meme();

drop trigger if exists club_draw_entries_notify_listener on public.club_draw_entries;
create trigger club_draw_entries_notify_listener
  after update of album_title, album_artist on public.club_draw_entries
  for each row execute function private.notify_album_given();

drop trigger if exists member_album_reviews_notify_proposer on public.member_album_reviews;
create trigger member_album_reviews_notify_proposer
  after insert on public.member_album_reviews
  for each row execute function private.notify_review_published();

drop trigger if exists club_draws_notify_members on public.club_draws;
create trigger club_draws_notify_members
  after update of status on public.club_draws
  for each row execute function private.notify_draw_published();

-- Let the browser receive a newly created notification without a refresh.
do $$
begin
  alter publication supabase_realtime add table public.member_notifications;
exception when duplicate_object then null;
end;
$$;
