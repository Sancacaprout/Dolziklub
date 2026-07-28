create table if not exists public.extra_listening_requests (
  id uuid primary key default gen_random_uuid(),
  draw_number integer not null references public.club_draws(draw_number) on delete cascade,
  requester_id uuid not null references public.member_profiles(id) on delete cascade,
  proposer_id uuid not null references public.member_profiles(id) on delete cascade,
  requester_username text not null,
  requester_display_name text not null,
  proposer_username text not null,
  proposer_display_name text not null,
  message text,
  status text not null default 'pending_proposal',
  album_title text,
  album_artist text,
  cover_path text,
  cover_source_url text,
  deezer_url text,
  youtube_music_url text,
  review_title text,
  review text,
  rating numeric,
  best_track text,
  worst_track text,
  requested_at timestamptz not null default now(),
  proposed_at timestamptz,
  reviewed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extra_listening_requests_distinct_members check (requester_id <> proposer_id),
  constraint extra_listening_requests_status_check check (
    status = any (array['pending_proposal', 'album_proposed', 'listening', 'reviewed', 'cancelled'])
  ),
  constraint extra_listening_requests_message_check check (
    message is null or char_length(btrim(message)) between 1 and 360
  ),
  constraint extra_listening_requests_album_check check (
    num_nonnulls(album_title, album_artist) = 0
    or (
      num_nonnulls(album_title, album_artist) = 2
      and char_length(btrim(album_title)) between 1 and 180
      and char_length(btrim(album_artist)) between 1 and 180
    )
  ),
  constraint extra_listening_requests_cover_path_check check (
    cover_path is null or char_length(btrim(cover_path)) between 1 and 500
  ),
  constraint extra_listening_requests_url_check check (
    (cover_source_url is null or char_length(btrim(cover_source_url)) between 1 and 1000)
    and (deezer_url is null or char_length(btrim(deezer_url)) between 1 and 1000)
    and (youtube_music_url is null or char_length(btrim(youtube_music_url)) between 1 and 1000)
  ),
  constraint extra_listening_requests_review_title_check check (
    review_title is null or char_length(btrim(review_title)) between 1 and 160
  ),
  constraint extra_listening_requests_review_check check (
    review is null or char_length(btrim(review)) between 1 and 2000
  ),
  constraint extra_listening_requests_rating_check check (
    rating is null or (rating >= 0 and rating <= 5 and rating * 2 = trunc(rating * 2))
  ),
  constraint extra_listening_requests_tracks_check check (
    (best_track is null or char_length(btrim(best_track)) between 1 and 160)
    and (worst_track is null or char_length(btrim(worst_track)) between 1 and 160)
  ),
  constraint extra_listening_requests_lifecycle_check check (
    (status = 'pending_proposal' and album_title is null and album_artist is null and proposed_at is null and reviewed_at is null and cancelled_at is null)
    or (status in ('album_proposed', 'listening') and album_title is not null and album_artist is not null and proposed_at is not null and reviewed_at is null and cancelled_at is null)
    or (status = 'reviewed' and album_title is not null and album_artist is not null and proposed_at is not null and review is not null and rating is not null and reviewed_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null)
  )
);

create index if not exists extra_listening_requests_draw_idx
  on public.extra_listening_requests (draw_number, requested_at desc);
create index if not exists extra_listening_requests_requester_idx
  on public.extra_listening_requests (requester_id, requested_at desc);
create index if not exists extra_listening_requests_proposer_status_idx
  on public.extra_listening_requests (proposer_id, status, requested_at desc);
create unique index if not exists extra_listening_requests_active_pair_idx
  on public.extra_listening_requests (draw_number, requester_id, proposer_id)
  where status in ('pending_proposal', 'album_proposed', 'listening');

alter table public.extra_listening_requests enable row level security;

revoke all on table public.extra_listening_requests from public, anon, authenticated;
grant select (
  id,
  draw_number,
  requester_username,
  requester_display_name,
  proposer_username,
  proposer_display_name,
  status,
  album_title,
  album_artist,
  cover_path,
  cover_source_url,
  deezer_url,
  youtube_music_url,
  review_title,
  review,
  rating,
  best_track,
  worst_track,
  requested_at,
  proposed_at,
  reviewed_at,
  cancelled_at,
  updated_at
) on table public.extra_listening_requests to anon, authenticated;
grant select (message) on table public.extra_listening_requests to authenticated;

drop policy if exists "Extra listenings are publicly readable" on public.extra_listening_requests;
create policy "Extra listenings are publicly readable"
  on public.extra_listening_requests for select
  to anon, authenticated
  using (true);

create or replace function private.touch_extra_listening_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_extra_listening_request() from public, anon, authenticated;

drop trigger if exists extra_listening_requests_touch_updated_at on public.extra_listening_requests;
create trigger extra_listening_requests_touch_updated_at
  before update on public.extra_listening_requests
  for each row execute function private.touch_extra_listening_request();

alter table public.member_notifications
  drop constraint if exists member_notifications_kind_check;
alter table public.member_notifications
  add constraint member_notifications_kind_check
  check (kind = any (array['meme', 'album', 'review', 'draw', 'task', 'comment', 'extra_request']));

create or replace function public.create_extra_listening_request(
  p_draw_number integer,
  p_proposer_username text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester public.member_profiles%rowtype;
  proposer public.member_profiles%rowtype;
  draw public.club_draws%rowtype;
  request_id uuid;
  clean_message text := nullif(btrim(p_message), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Connecte-toi pour envoyer une demande.';
  end if;

  select * into requester
  from public.member_profiles
  where id = (select auth.uid());

  select * into proposer
  from public.member_profiles
  where lower(username) = lower(btrim(p_proposer_username));

  select * into draw
  from public.club_draws
  where draw_number = p_draw_number
    and status in ('published', 'locked');

  if requester.id is null or proposer.id is null or draw.draw_number is null then
    raise exception 'Le tirage ou le membre choisi est introuvable.';
  end if;
  if requester.id = proposer.id then
    raise exception 'Choisis un autre membre du tirage.';
  end if;
  if not (lower(requester.username) = any (draw.participant_usernames))
    or not (lower(proposer.username) = any (draw.participant_usernames)) then
    raise exception 'Les deux membres doivent participer à ce tirage.';
  end if;
  if clean_message is not null and char_length(clean_message) > 360 then
    raise exception 'Le message doit contenir 360 caractères maximum.';
  end if;

  begin
    insert into public.extra_listening_requests (
      draw_number,
      requester_id,
      proposer_id,
      requester_username,
      requester_display_name,
      proposer_username,
      proposer_display_name,
      message
    ) values (
      draw.draw_number,
      requester.id,
      proposer.id,
      requester.username,
      requester.display_name,
      proposer.username,
      proposer.display_name,
      clean_message
    ) returning id into request_id;
  exception when unique_violation then
    raise exception 'Une demande active existe déjà auprès de ce membre pour ce tirage.';
  end;

  perform private.add_member_notification(
    proposer.id,
    'extra_request',
    'Nouvelle écoute supplémentaire',
    requester.display_name || ' souhaite que tu lui proposes un album supplémentaire.',
    '/tableur?extra=' || request_id::text || '&mode=propose'
  );

  return request_id;
end;
$$;

create or replace function public.propose_extra_listening_album(
  p_request_id uuid,
  p_album_title text,
  p_album_artist text,
  p_cover_path text default null,
  p_cover_source_url text default null,
  p_deezer_url text default null,
  p_youtube_music_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.extra_listening_requests%rowtype;
  was_pending boolean;
  clean_title text := btrim(p_album_title);
  clean_artist text := btrim(p_album_artist);
begin
  select * into request
  from public.extra_listening_requests
  where id = p_request_id
  for update;

  if request.id is null then
    raise exception 'Cette demande est introuvable.';
  end if;
  if (select auth.uid()) <> request.proposer_id and not (select private.is_member_admin()) then
    raise exception 'Cette demande ne t’est pas adressée.';
  end if;
  if request.status in ('reviewed', 'cancelled') then
    raise exception 'Cette proposition est désormais verrouillée.';
  end if;
  if char_length(clean_title) not between 1 and 180
    or char_length(clean_artist) not between 1 and 180 then
    raise exception 'Renseigne un titre et un artiste valides.';
  end if;

  was_pending := request.status = 'pending_proposal';

  update public.extra_listening_requests
  set album_title = clean_title,
      album_artist = clean_artist,
      cover_path = nullif(btrim(p_cover_path), ''),
      cover_source_url = nullif(btrim(p_cover_source_url), ''),
      deezer_url = nullif(btrim(p_deezer_url), ''),
      youtube_music_url = nullif(btrim(p_youtube_music_url), ''),
      status = case when request.status = 'listening' then 'listening' else 'album_proposed' end,
      proposed_at = coalesce(request.proposed_at, now())
  where id = p_request_id;

  if was_pending then
    perform private.add_member_notification(
      request.requester_id,
      'extra_request',
      'Ton album supplémentaire est prêt',
      request.proposer_display_name || ' a proposé un album pour ton écoute supplémentaire.',
      '/tableur?extra=' || request.id::text || '&mode=listen'
    );
  end if;

  return request.id;
end;
$$;

create or replace function public.clear_extra_listening_album(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.extra_listening_requests%rowtype;
begin
  select * into request
  from public.extra_listening_requests
  where id = p_request_id
  for update;

  if request.id is null then
    raise exception 'Cette demande est introuvable.';
  end if;
  if (select auth.uid()) <> request.proposer_id and not (select private.is_member_admin()) then
    raise exception 'Cette demande ne t’est pas adressée.';
  end if;
  if request.status in ('reviewed', 'cancelled') then
    raise exception 'Cette proposition est désormais verrouillée.';
  end if;

  update public.extra_listening_requests
  set status = 'pending_proposal',
      album_title = null,
      album_artist = null,
      cover_path = null,
      cover_source_url = null,
      deezer_url = null,
      youtube_music_url = null,
      proposed_at = null
  where id = p_request_id;

  return request.id;
end;
$$;

create or replace function public.start_my_extra_listening(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.extra_listening_requests%rowtype;
begin
  select * into request
  from public.extra_listening_requests
  where id = p_request_id
  for update;

  if request.id is null or request.requester_id <> (select auth.uid()) then
    raise exception 'Cette écoute ne t’appartient pas.';
  end if;
  if request.status not in ('album_proposed', 'listening') then
    raise exception 'Cet album n’est pas prêt à être écouté.';
  end if;

  update public.extra_listening_requests
  set status = 'listening'
  where id = p_request_id;

  return request.id;
end;
$$;

create or replace function public.save_my_extra_listening_review(
  p_request_id uuid,
  p_review_title text,
  p_review text,
  p_rating numeric,
  p_best_track text default null,
  p_worst_track text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.extra_listening_requests%rowtype;
  clean_review text := btrim(p_review);
begin
  select * into request
  from public.extra_listening_requests
  where id = p_request_id
  for update;

  if request.id is null or request.requester_id <> (select auth.uid()) then
    raise exception 'Cette écoute ne t’appartient pas.';
  end if;
  if request.status not in ('album_proposed', 'listening') then
    raise exception 'Ce verdict ne peut plus être modifié.';
  end if;
  if char_length(clean_review) not between 1 and 2000 then
    raise exception 'Ton avis doit contenir entre 1 et 2000 caractères.';
  end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 or p_rating * 2 <> trunc(p_rating * 2) then
    raise exception 'Choisis une note comprise entre 0 et 5 par demi-point.';
  end if;

  update public.extra_listening_requests
  set status = 'reviewed',
      review_title = nullif(btrim(p_review_title), ''),
      review = clean_review,
      rating = p_rating,
      best_track = nullif(btrim(p_best_track), ''),
      worst_track = nullif(btrim(p_worst_track), ''),
      reviewed_at = now()
  where id = p_request_id;

  perform private.add_member_notification(
    request.proposer_id,
    'extra_request',
    'Verdict supplémentaire reçu',
    request.requester_display_name || ' a terminé l’album que tu lui avais proposé.',
    '/tableur?extra=' || request.id::text
  );

  return request.id;
end;
$$;

create or replace function public.cancel_extra_listening_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.extra_listening_requests%rowtype;
begin
  select * into request
  from public.extra_listening_requests
  where id = p_request_id
  for update;

  if request.id is null then
    raise exception 'Cette demande est introuvable.';
  end if;
  if (select auth.uid()) <> request.requester_id and not (select private.is_member_admin()) then
    raise exception 'Cette demande ne t’appartient pas.';
  end if;
  if request.status = 'reviewed' then
    raise exception 'Une écoute évaluée reste conservée dans l’historique.';
  end if;
  if request.status = 'cancelled' then
    return request.id;
  end if;

  update public.extra_listening_requests
  set status = 'cancelled',
      cancelled_at = now()
  where id = p_request_id;

  return request.id;
end;
$$;

revoke all on function public.create_extra_listening_request(integer, text, text) from public, anon;
revoke all on function public.propose_extra_listening_album(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.clear_extra_listening_album(uuid) from public, anon;
revoke all on function public.start_my_extra_listening(uuid) from public, anon;
revoke all on function public.save_my_extra_listening_review(uuid, text, text, numeric, text, text) from public, anon;
revoke all on function public.cancel_extra_listening_request(uuid) from public, anon;

grant execute on function public.create_extra_listening_request(integer, text, text) to authenticated;
grant execute on function public.propose_extra_listening_album(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.clear_extra_listening_album(uuid) to authenticated;
grant execute on function public.start_my_extra_listening(uuid) to authenticated;
grant execute on function public.save_my_extra_listening_review(uuid, text, text, numeric, text, text) to authenticated;
grant execute on function public.cancel_extra_listening_request(uuid) to authenticated;

update public.site_updates
set display_order = display_order + 1;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'extra-listening-requests',
  date '2026-07-28',
  0,
  $$
  {
    "version": "2.6",
    "title": "Une écoute supplémentaire, choisie rien que pour toi",
    "summary": "Tu peux maintenant demander à un membre du tirage de te proposer un album inédit, puis publier ton verdict dans une section séparée du tirage classique.",
    "categories": ["Nouvelle fonctionnalité", "Amélioration", "Albums", "Tirages"],
    "added": [
      {"text": "Chaque tirage possède désormais son sous-tableau « Écoutes supplémentaires », clairement identifié comme hors tirage classique."},
      {"text": "Le membre choisi reçoit la demande, propose son album avec l’aide Deezer, puis le demandeur peut enregistrer son avis, sa note et ses morceaux marquants."},
      {"text": "Les demandes et propositions déclenchent les notifications utiles sans créer de nouvelle place dans le tirage."}
    ],
    "fixed": [
      {"text": "Le parcours existant porte maintenant le nom précis « Donner un avis bonus sur un album du tirage » afin de ne plus le confondre avec une nouvelle proposition."}
    ],
    "improved": [
      {"text": "Les écoutes supplémentaires restent en dehors des moyennes, affectations et classements officiels."}
    ],
    "links": [
      {"label": "Ouvrir le tableur", "href": "/tableur"}
    ]
  }
  $$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content,
    updated_at = now();
