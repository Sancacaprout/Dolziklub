-- Notification copy should name the member who performed the action.
create or replace function private.notify_new_meme()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  author_name text;
begin
  select coalesce(nullif(btrim(profile.display_name), ''), profile.username)
    into author_name
  from public.member_profiles as profile
  where profile.id = new.created_by;

  insert into public.member_notifications (recipient_id, kind, title, body, href)
  select profile.id, 'meme', 'Nouveau mème au musée', coalesce(author_name, 'Un membre') || ' vient de publier un nouveau mème.', '/memes'
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
      'album',
      'Nouvel album à écouter',
      coalesce(giver_name, new.proposed_by_name, 'Un membre') || ' t’a donné « ' || new.album_title || ' » de ' || new.album_artist || '.',
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
    select coalesce(nullif(btrim(profile.display_name), ''), profile.username)
      into reviewer_name
    from public.member_profiles as profile
    where profile.id = new.member_id;

    perform private.add_member_notification(
      entry.proposed_by,
      'review',
      'Un avis est arrivé',
      coalesce(reviewer_name, entry.listened_by_name, 'Un membre') || ' a donné son avis sur « ' || coalesce(entry.album_title, 'ton album') || ' ».',
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
    select profile.id, 'draw', 'Tirage #' || new.draw_number || ' publié', 'Le tirage #' || new.draw_number || ' est prêt : découvre ton binôme.', '/tableur'
    from public.member_profiles as profile;
  end if;
  return new;
end;
$$;
