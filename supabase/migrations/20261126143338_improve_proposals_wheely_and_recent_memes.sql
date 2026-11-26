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
  same_album boolean;
  caller_id uuid := (select auth.uid());
  next_cover_path text := nullif(btrim(p_cover_path), '');
  next_cover_url text := nullif(btrim(p_cover_source_url), '');
  next_deezer_url text := nullif(btrim(p_deezer_url), '');
  next_youtube_url text := nullif(btrim(p_youtube_music_url), '');
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
  if caller_id is null or (caller_id <> request.proposer_id and not (select private.is_member_admin())) then
    raise exception 'Cette demande ne t’est pas adressée.';
  end if;
  if request.status in ('reviewed', 'cancelled') then
    raise exception 'Cette proposition est désormais verrouillée.';
  end if;
  if clean_title is null or clean_artist is null
    or char_length(clean_title) not between 1 and 180
    or char_length(clean_artist) not between 1 and 180 then
    raise exception 'Renseigne un titre et un artiste valides.';
  end if;

  if next_cover_path is not null
     and next_cover_path !~ ('^' || caller_id::text || '/extra/' || request.id::text || '\.(jpg|jpeg|png|webp)$') then
    raise exception 'La pochette ne correspond pas à cette demande.';
  end if;

  was_pending := request.status = 'pending_proposal';
  same_album := (request.album_title, request.album_artist) is not distinct from (clean_title, clean_artist);
  if same_album then
    next_cover_path := coalesce(next_cover_path, request.cover_path);
    next_cover_url := coalesce(next_cover_url, request.cover_source_url);
    next_deezer_url := coalesce(next_deezer_url, request.deezer_url);
    next_youtube_url := coalesce(next_youtube_url, request.youtube_music_url);
  end if;

  -- The request row is the idempotency key. A retry never inserts a second
  -- proposal or repeats its first notification.
  if not was_pending and same_album
     and (next_cover_path, next_cover_url, next_deezer_url, next_youtube_url)
       is not distinct from (request.cover_path, request.cover_source_url, request.deezer_url, request.youtube_music_url) then
    return request.id;
  end if;

  update public.extra_listening_requests
  set album_title = clean_title,
      album_artist = clean_artist,
      cover_path = next_cover_path,
      cover_source_url = next_cover_url,
      deezer_url = next_deezer_url,
      youtube_music_url = next_youtube_url,
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

create or replace function public.recent_published_memes()
returns table (id uuid, image_path text, caption text, comment_count bigint)
language sql stable security invoker set search_path = ''
as $$
  with recent as (
    select post.id, post.image_path, post.caption, post.created_at
    from public.meme_posts post
    order by post.created_at desc, post.id desc
    limit 4
  )
  select recent.id, recent.image_path, recent.caption, count(comment.id)
  from recent
  left join public.meme_comments comment on comment.meme_id = 'upload-' || recent.id::text
  group by recent.id, recent.image_path, recent.caption, recent.created_at
  order by recent.created_at desc, recent.id desc
$$;

revoke all on function public.recent_published_memes() from public, anon, authenticated;
grant execute on function public.recent_published_memes() to anon, authenticated;

create table if not exists private.wheely_ranked_runs (
  participant_id uuid primary key references public.member_public_profiles(id) on delete cascade,
  run_id uuid not null,
  started_at timestamptz not null,
  finished_at timestamptz
);

create table if not exists private.wheely_member_records (
  participant_id uuid primary key references public.member_public_profiles(id) on delete cascade,
  best_score integer not null check (best_score >= 0),
  record_at timestamptz not null
);

alter table private.wheely_ranked_runs enable row level security;
alter table private.wheely_member_records enable row level security;
revoke all on private.wheely_ranked_runs, private.wheely_member_records from public, anon, authenticated;

create or replace function public.get_wheely_club_results()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with ranked as (
    select score.participant_id, profile.display_name, score.best_score, score.record_at,
           rank() over (order by score.best_score desc) as rank
    from private.wheely_member_records score
    join public.member_profiles profile on profile.id = score.participant_id
  ), leaders as (
    select * from ranked order by rank, record_at, participant_id limit 5
  )
  select jsonb_build_object(
    'leaders', coalesce((select jsonb_agg(jsonb_build_object(
      'name', leaders.display_name, 'score', leaders.best_score, 'rank', leaders.rank
    ) order by leaders.rank, leaders.record_at, leaders.participant_id) from leaders), '[]'::jsonb),
    'personal', (select jsonb_build_object('score', ranked.best_score, 'rank', ranked.rank, 'recordAt', ranked.record_at)
      from ranked where ranked.participant_id = (select auth.uid())),
    'successes', coalesce((select jsonb_agg(jsonb_build_object(
      'name', profile.display_name, 'completedAt', reward.unlocked_at, 'score', score.best_score
    ) order by reward.unlocked_at, profile.display_name)
      from public.participant_achievements reward
      join public.member_profiles profile on profile.id = reward.participant_id
      left join private.wheely_member_records score on score.participant_id = reward.participant_id
      where reward.achievement_key = 'wheely-theme'), '[]'::jsonb),
    'rider', case when (select auth.uid()) is not null then exists (
      select 1 from public.participant_badges badge
      where badge.participant_id = (select auth.uid()) and badge.badge_key = 'b25'
    ) end
  )
$$;

revoke all on function public.get_wheely_club_results() from public, anon, authenticated;
grant execute on function public.get_wheely_club_results() to anon, authenticated;

create or replace function public.start_wheely_ranked_run()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  token uuid := gen_random_uuid();
begin
  if caller_id is null or not exists (select 1 from public.member_public_profiles where id = caller_id) then
    raise exception 'Connexion membre requise.';
  end if;
  insert into private.wheely_ranked_runs (participant_id, run_id, started_at)
  values (caller_id, token, clock_timestamp())
  on conflict (participant_id) do update
  set run_id = excluded.run_id, started_at = excluded.started_at, finished_at = null;
  return token;
end;
$$;

create or replace function public.finish_wheely_ranked_run(
  p_run_id uuid, p_distance integer, p_avoided integer, p_completed boolean
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  run private.wheely_ranked_runs%rowtype;
  finished timestamptz := clock_timestamp();
  elapsed numeric;
  score integer;
begin
  if caller_id is null then raise exception 'Connexion membre requise.'; end if;
  select * into run from private.wheely_ranked_runs
  where participant_id = caller_id and run_id = p_run_id for update;
  if not found then raise exception 'Cette partie a expiré.'; end if;
  if run.finished_at is not null then return public.get_wheely_club_results(); end if;

  elapsed := extract(epoch from (finished - run.started_at));
  -- Engine constants: maximum 46 displayed metres/second, at most three
  -- obstacles per wave and at least 25.5 displayed metres between waves.
  if elapsed < 0 or elapsed > 1800 or p_distance is null or p_avoided is null or p_completed is null
     or p_distance < 0 or p_distance > ceil(46 * least(180, elapsed + 2))
     or p_avoided < 0 or p_avoided > 3 * (1 + floor(p_distance / 25.5))
     or (p_completed and (elapsed < 72 or p_distance < 1000)) then
    raise exception 'Le score ne correspond pas à une partie Wheely valide.';
  end if;

  score := p_distance + p_avoided * 25;
  update private.wheely_ranked_runs set finished_at = finished where participant_id = caller_id;
  insert into private.wheely_member_records (participant_id, best_score, record_at)
  values (caller_id, score, finished)
  on conflict (participant_id) do update
  set best_score = excluded.best_score, record_at = excluded.record_at
  where wheely_member_records.best_score < excluded.best_score;

  if p_completed then
    insert into public.participant_achievements (participant_id, achievement_key, unlocked_at, detail)
    values (caller_id, 'wheely-theme', finished, jsonb_build_object(
      'source', 'wheely-audio-ended', 'run_id', p_run_id, 'score', score,
      'distance', p_distance, 'verified_elapsed_ms', floor(elapsed * 1000)
    )) on conflict (participant_id, achievement_key) do nothing;
  end if;

  return public.get_wheely_club_results();
end;
$$;

revoke all on function public.start_wheely_ranked_run() from public, anon, authenticated;
revoke all on function public.finish_wheely_ranked_run(uuid, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.start_wheely_ranked_run() to authenticated;
grant execute on function public.finish_wheely_ranked_run(uuid, integer, integer, boolean) to authenticated;
