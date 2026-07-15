-- Actionable reminders for current and future draws, plus meme comment alerts.
alter table public.member_notifications
  drop constraint if exists member_notifications_kind_check;

alter table public.member_notifications
  add constraint member_notifications_kind_check
  check (kind in ('meme', 'album', 'review', 'draw', 'task', 'comment'));

create or replace function private.notify_album_given()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  giver_name text;
begin
  if new.listened_by is not null
     and new.proposed_by is distinct from new.listened_by
     and (old.album_title is null or old.album_artist is null)
     and new.album_title is not null
     and new.album_artist is not null then
    select coalesce(nullif(btrim(profile.display_name), ''), profile.username)
      into giver_name
    from public.member_profiles as profile
    where profile.id = new.proposed_by;

    perform private.add_member_notification(
      new.listened_by,
      'task',
      'Tu dois rendre un avis',
      coalesce(giver_name, new.proposed_by_name, 'Un membre') || ' t’a donné « ' || new.album_title || ' » de ' || new.album_artist || '.',
      '/tableur?review=' || new.id::text
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

    insert into public.member_notifications (recipient_id, kind, title, body, href)
    select
      entry.proposed_by,
      'task',
      'Tu dois proposer un album',
      'Le tirage #' || new.draw_number || ' est en ligne : propose un album pour ' ||
        coalesce(
          (select coalesce(nullif(btrim(profile.display_name), ''), profile.username)
             from public.member_profiles as profile
            where profile.id = entry.listened_by),
          entry.listened_by_name,
          'ton binôme'
        ) || '.',
      '/tableur?proposal=' || entry.id::text
    from public.club_draw_entries as entry
    where entry.draw_number = new.draw_number
      and entry.proposed_by is not null
      and (entry.album_title is null or entry.album_artist is null);
  end if;
  return new;
end;
$$;

create or replace function private.notify_meme_comment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  meme_owner_id uuid;
  commenter_name text;
begin
  select post.created_by
    into meme_owner_id
  from public.meme_posts as post
  where 'upload-' || post.id::text = new.meme_id;

  if meme_owner_id is null or meme_owner_id = new.author_id then
    return new;
  end if;

  if new.is_anonymous then
    commenter_name := 'Un membre';
  else
    select coalesce(nullif(btrim(profile.display_name), ''), profile.username)
      into commenter_name
    from public.member_profiles as profile
    where profile.id = new.author_id;
  end if;

  perform private.add_member_notification(
    meme_owner_id,
    'comment',
    'Quelqu’un a commenté ton mème',
    coalesce(commenter_name, 'Un membre') || ' a laissé un commentaire sur ton mème.',
    '/memes'
  );
  return new;
end;
$$;

revoke all on function private.notify_meme_comment() from public, anon, authenticated;

drop trigger if exists meme_comments_notify_owner on public.meme_comments;
create trigger meme_comments_notify_owner
  after insert on public.meme_comments
  for each row execute function private.notify_meme_comment();

-- Add the reminders that are still open in the currently published draw.
insert into public.member_notifications (recipient_id, kind, title, body, href)
select
  entry.proposed_by,
  'task',
  'Tu dois proposer un album',
  'Le tirage #' || draw.draw_number || ' est en cours : propose un album pour ' ||
    coalesce(
      (select coalesce(nullif(btrim(profile.display_name), ''), profile.username)
         from public.member_profiles as profile
        where profile.id = entry.listened_by),
      entry.listened_by_name,
      'ton binôme'
    ) || '.',
  '/tableur?proposal=' || entry.id::text
from public.club_draw_entries as entry
join public.club_draws as draw on draw.draw_number = entry.draw_number
where draw.status = 'published'
  and entry.proposed_by is not null
  and (entry.album_title is null or entry.album_artist is null)
  and not exists (
    select 1
    from public.member_notifications as notification
    where notification.recipient_id = entry.proposed_by
      and notification.href = '/tableur?proposal=' || entry.id::text
  );

insert into public.member_notifications (recipient_id, kind, title, body, href)
select
  entry.listened_by,
  'task',
  'Tu dois rendre un avis',
  coalesce(
    (select coalesce(nullif(btrim(profile.display_name), ''), profile.username)
       from public.member_profiles as profile
      where profile.id = entry.proposed_by),
    entry.proposed_by_name,
    'Un membre'
  ) || ' t’a donné « ' || entry.album_title || ' » de ' || entry.album_artist || '.',
  '/tableur?review=' || entry.id::text
from public.club_draw_entries as entry
join public.club_draws as draw on draw.draw_number = entry.draw_number
left join public.member_album_reviews as review on review.album_id = entry.id::text
where draw.status = 'published'
  and entry.listened_by is not null
  and entry.album_title is not null
  and entry.album_artist is not null
  and review.id is null
  and not exists (
    select 1
    from public.member_notifications as notification
    where notification.recipient_id = entry.listened_by
      and notification.href = '/tableur?review=' || entry.id::text
  );
