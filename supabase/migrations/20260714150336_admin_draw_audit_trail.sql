-- A permanent, append-only audit trail for the administration of club draws.
-- It is intentionally separate from the public draw data: only administrators
-- may read it and no browser role can insert, edit or delete its rows.
create table if not exists public.club_draw_audit_log (
  id uuid primary key default gen_random_uuid(),
  draw_number integer not null check (draw_number >= 1),
  entry_id uuid references public.club_draw_entries(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_username text,
  actor_display_name text,
  event_type text not null check (event_type in (
    'draw_created',
    'draw_published',
    'draw_locked',
    'draw_deleted',
    'draw_participants_updated',
    'entry_assignment_updated',
    'album_proposed',
    'album_updated',
    'album_removed',
    'verdict_submitted',
    'verdict_updated',
    'verdict_reset'
  )),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists club_draw_audit_log_draw_created_idx
  on public.club_draw_audit_log (draw_number, created_at desc);
create index if not exists club_draw_audit_log_created_idx
  on public.club_draw_audit_log (created_at desc);

alter table public.club_draw_audit_log enable row level security;
revoke all on table public.club_draw_audit_log from anon, authenticated;
grant select on table public.club_draw_audit_log to authenticated;

drop policy if exists "Administrators can read draw audit history" on public.club_draw_audit_log;
create policy "Administrators can read draw audit history"
  on public.club_draw_audit_log for select to authenticated
  using ((select private.is_member_admin()));

create or replace function private.log_club_draw_event(
  p_draw_number integer,
  p_entry_id uuid,
  p_event_type text,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile public.member_profiles%rowtype;
begin
  -- auth.uid() remains the caller of an RPC even when the enclosing function
  -- is SECURITY DEFINER. Keeping the actor here makes the log useful without
  -- granting writers direct access to the log table.
  select * into profile
  from public.member_profiles
  where id = (select auth.uid());

  insert into public.club_draw_audit_log (
    draw_number, entry_id, actor_id, actor_username, actor_display_name,
    event_type, detail
  ) values (
    p_draw_number,
    p_entry_id,
    (select auth.uid()),
    profile.username,
    profile.display_name,
    p_event_type,
    coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;
revoke all on function private.log_club_draw_event(integer, uuid, text, jsonb)
  from public, anon, authenticated;

create or replace function private.audit_club_draw_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_club_draw_event(
      new.draw_number,
      null,
      'draw_created',
      jsonb_build_object('participants', new.participant_usernames, 'status', new.status)
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform private.log_club_draw_event(
      old.draw_number,
      null,
      'draw_deleted',
      jsonb_build_object('participants', old.participant_usernames, 'status', old.status)
    );
    return old;
  end if;

  if new.participant_usernames is distinct from old.participant_usernames then
    perform private.log_club_draw_event(
      new.draw_number,
      null,
      'draw_participants_updated',
      jsonb_build_object('before', old.participant_usernames, 'after', new.participant_usernames)
    );
  end if;
  if new.status is distinct from old.status then
    perform private.log_club_draw_event(
      new.draw_number,
      null,
      case when new.status = 'published' then 'draw_published' else 'draw_locked' end,
      jsonb_build_object('before', old.status, 'after', new.status)
    );
  end if;
  return new;
end;
$$;
revoke all on function private.audit_club_draw_lifecycle() from public, anon, authenticated;

drop trigger if exists club_draws_audit_lifecycle on public.club_draws;
create trigger club_draws_audit_lifecycle
  after insert or update or delete on public.club_draws
  for each row execute function private.audit_club_draw_lifecycle();

create or replace function private.audit_club_draw_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  album_was_present boolean;
  album_is_present boolean;
begin
  if tg_op <> 'UPDATE' then return new; end if;

  album_was_present := old.album_title is not null or old.album_artist is not null;
  album_is_present := new.album_title is not null or new.album_artist is not null;

  if new.proposed_by is distinct from old.proposed_by
      or new.listened_by is distinct from old.listened_by then
    perform private.log_club_draw_event(
      new.draw_number,
      new.id,
      'entry_assignment_updated',
      jsonb_build_object(
        'position', new.position,
        'before', jsonb_build_object('proposed_by', old.proposed_by_name, 'listened_by', old.listened_by_name),
        'after', jsonb_build_object('proposed_by', new.proposed_by_name, 'listened_by', new.listened_by_name),
        'cleared_album', album_was_present and not album_is_present
      )
    );
  elsif new.album_title is distinct from old.album_title
      or new.album_artist is distinct from old.album_artist then
    perform private.log_club_draw_event(
      new.draw_number,
      new.id,
      case
        when not album_was_present and album_is_present then 'album_proposed'
        when album_was_present and not album_is_present then 'album_removed'
        else 'album_updated'
      end,
      jsonb_build_object(
        'position', new.position,
        'before', jsonb_build_object('title', old.album_title, 'artist', old.album_artist),
        'after', jsonb_build_object('title', new.album_title, 'artist', new.album_artist)
      )
    );
  end if;
  return new;
end;
$$;
revoke all on function private.audit_club_draw_entry() from public, anon, authenticated;

drop trigger if exists club_draw_entries_audit_history on public.club_draw_entries;
create trigger club_draw_entries_audit_history
  after update on public.club_draw_entries
  for each row execute function private.audit_club_draw_entry();

create or replace function private.audit_member_draw_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_entry public.club_draw_entries%rowtype;
  event_album_id text;
  event_rating numeric;
  event_best_track text;
  event_worst_track text;
  event_review_text text;
begin
  if tg_op = 'DELETE' then
    event_album_id := old.album_id;
    event_rating := old.rating;
    event_best_track := old.best_track;
    event_worst_track := old.worst_track;
    event_review_text := old.review;
  else
    event_album_id := new.album_id;
    event_rating := new.rating;
    event_best_track := new.best_track;
    event_worst_track := new.worst_track;
    event_review_text := new.review;
  end if;
  select * into row_entry
  from public.club_draw_entries
  where id::text = event_album_id;
  if not found then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  perform private.log_club_draw_event(
    row_entry.draw_number,
    row_entry.id,
    case
      when tg_op = 'INSERT' then 'verdict_submitted'
      when tg_op = 'DELETE' then 'verdict_reset'
      else 'verdict_updated'
    end,
    jsonb_build_object(
      'position', row_entry.position,
      'album_title', row_entry.album_title,
      'rating', event_rating,
      'has_best_track', nullif(btrim(coalesce(event_best_track, '')), '') is not null,
      'has_worst_track', nullif(btrim(coalesce(event_worst_track, '')), '') is not null,
      'review_length', char_length(coalesce(event_review_text, ''))
    )
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.audit_member_draw_review() from public, anon, authenticated;

drop trigger if exists member_album_reviews_audit_draw_history on public.member_album_reviews;
create trigger member_album_reviews_audit_draw_history
  after insert or update or delete on public.member_album_reviews
  for each row execute function private.audit_member_draw_review();
