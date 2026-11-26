-- Tribunal results become available automatically when the caller has answered
-- every active question. Completion is materialized so historical and future
-- sessions follow the same rule without an administrator reveal step.

alter table public.tribunal_session_participants
  add column if not exists completed_at timestamptz;

comment on column public.tribunal_session_participants.completed_at is
  'Set automatically when this participant has one response for every active Tribunal question.';

create index if not exists tribunal_session_participants_completed_idx
  on public.tribunal_session_participants (session_id, completed_at)
  where completed_at is not null;

create or replace function private.refresh_tribunal_participant_completion(
  p_session_id bigint,
  p_participant_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_completed boolean;
  refreshed_at timestamptz;
begin
  -- Serialize completion checks for concurrent saves by the same participant.
  perform 1
  from public.tribunal_session_participants participant
  where participant.session_id = p_session_id
    and participant.participant_id = p_participant_id
  for no key update;

  if not found then
    return null;
  end if;

  select
    exists (
      select 1
      from public.tribunal_questions active_question
      where active_question.session_id = p_session_id
        and active_question.is_active
    )
    and not exists (
      select 1
      from public.tribunal_questions active_question
      where active_question.session_id = p_session_id
        and active_question.is_active
        and not exists (
          select 1
          from public.tribunal_responses own_response
          where own_response.session_id = p_session_id
            and own_response.question_id = active_question.id
            and own_response.respondent_participant_id = p_participant_id
        )
    )
  into participant_completed;

  update public.tribunal_session_participants participant
  set completed_at = case
    when participant_completed then coalesce(participant.completed_at, now())
    else null
  end
  where participant.session_id = p_session_id
    and participant.participant_id = p_participant_id
  returning participant.completed_at into refreshed_at;

  return refreshed_at;
end;
$$;

revoke all on function private.refresh_tribunal_participant_completion(bigint, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.sync_tribunal_response_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_tribunal_participant_completion(
      old.session_id,
      old.respondent_participant_id
    );
    return old;
  end if;

  perform private.refresh_tribunal_participant_completion(
    new.session_id,
    new.respondent_participant_id
  );

  if tg_op = 'UPDATE'
     and (old.session_id, old.respondent_participant_id)
       is distinct from (new.session_id, new.respondent_participant_id) then
    perform private.refresh_tribunal_participant_completion(
      old.session_id,
      old.respondent_participant_id
    );
  end if;

  return new;
end;
$$;

revoke all on function private.sync_tribunal_response_completion()
  from public, anon, authenticated, service_role;

drop trigger if exists sync_tribunal_response_completion
  on public.tribunal_responses;
create trigger sync_tribunal_response_completion
  after insert or update or delete
  on public.tribunal_responses
  for each row execute function private.sync_tribunal_response_completion();

create or replace function private.refresh_tribunal_session_completion(
  p_session_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_record record;
begin
  for participant_record in
    select participant.participant_id
    from public.tribunal_session_participants participant
    where participant.session_id = p_session_id
    order by participant.participant_id
  loop
    perform private.refresh_tribunal_participant_completion(
      p_session_id,
      participant_record.participant_id
    );
  end loop;
end;
$$;

revoke all on function private.refresh_tribunal_session_completion(bigint)
  from public, anon, authenticated, service_role;

create or replace function private.sync_tribunal_question_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_tribunal_session_completion(old.session_id);
    return old;
  end if;

  perform private.refresh_tribunal_session_completion(new.session_id);

  if tg_op = 'UPDATE' and old.session_id is distinct from new.session_id then
    perform private.refresh_tribunal_session_completion(old.session_id);
  end if;

  return new;
end;
$$;

revoke all on function private.sync_tribunal_question_completion()
  from public, anon, authenticated, service_role;

drop trigger if exists sync_tribunal_question_completion
  on public.tribunal_questions;
create trigger sync_tribunal_question_completion
  after insert or delete or update of is_active, session_id
  on public.tribunal_questions
  for each row execute function private.sync_tribunal_question_completion();

-- Backfill every historical participation without deleting or rewriting any
-- response. This also repairs stale completion state if active questions changed.
do $backfill$
declare
  participant_record record;
begin
  for participant_record in
    select participant.session_id, participant.participant_id
    from public.tribunal_session_participants participant
  loop
    perform private.refresh_tribunal_participant_completion(
      participant_record.session_id,
      participant_record.participant_id
    );
  end loop;
end;
$backfill$;

-- Replace either the original admin-release guard or the first automatic guard.
-- Failing closed when neither known guard exists prevents silently weakening a
-- function that may have changed independently in production.
do $migration$
declare
  function_definition text;
  legacy_guard constant text := $guard$
  if selected_session.status <> 'results_revealed' and not caller_is_admin then
    raise exception 'Les résultats ne sont pas encore révélés';
  end if;
$guard$;
  derived_completion_guard constant text := $guard$
  if selected_session.status <> 'results_revealed'
     and not caller_is_admin
     and not exists (
       select 1
       from public.tribunal_session_participants participant
       where participant.session_id = selected_session.id
         and participant.participant_id = caller_id
         and exists (
           select 1
           from public.tribunal_questions active_question
           where active_question.session_id = selected_session.id
             and active_question.is_active
         )
         and not exists (
           select 1
           from public.tribunal_questions active_question
           where active_question.session_id = selected_session.id
             and active_question.is_active
             and not exists (
               select 1
               from public.tribunal_responses own_response
               where own_response.session_id = selected_session.id
                 and own_response.question_id = active_question.id
                 and own_response.respondent_participant_id = caller_id
             )
         )
     ) then
    raise exception 'Termine toutes les questions avant de consulter les résultats';
  end if;
$guard$;
  completed_at_guard constant text := $guard$
  if not caller_is_admin
     and not exists (
       select 1
       from public.tribunal_session_participants participant
       where participant.session_id = selected_session.id
         and participant.participant_id = caller_id
         and participant.completed_at is not null
     ) then
    raise exception 'Termine toutes les questions avant de consulter les résultats';
  end if;
$guard$;
  anonymous_answers_pattern constant text := $pattern$    if question_record\.type = 'member_text' then\s+select coalesce\(jsonb_agg\(jsonb_build_object\([\s\S]*?into free_answers[\s\S]*?free_answers := '\[\]'::jsonb;\s+end if;$pattern$;
  no_individual_answers constant text := '    free_answers := ''[]''::jsonb;';
begin
  select pg_get_functiondef(
    'public.get_tribunal_results(bigint)'::regprocedure
  ) into function_definition;

  if position(completed_at_guard in function_definition) > 0 then
    null;
  elsif position(derived_completion_guard in function_definition) > 0 then
    function_definition := replace(
      function_definition,
      derived_completion_guard,
      completed_at_guard
    );
  elsif position(legacy_guard in function_definition) > 0 then
    function_definition := replace(
      function_definition,
      legacy_guard,
      completed_at_guard
    );
  else
    raise exception 'Le garde d’accès du Tribunal a changé; migration arrêtée sans modifier les permissions';
  end if;

  -- Keep the legacy response shape for existing clients, without returning
  -- individual free-text votes. Administrators still moderate through context.
  if function_definition ~ anonymous_answers_pattern then
    function_definition := regexp_replace(
      function_definition, anonymous_answers_pattern, no_individual_answers
    );
  elsif position(no_individual_answers in function_definition) = 0
     or position('response.free_text' in function_definition) > 0 then
    raise exception 'Le format des réponses libres du Tribunal a changé';
  end if;

  execute function_definition;
end;
$migration$;

revoke all on function public.get_tribunal_results(bigint)
  from public, anon, authenticated;
grant execute on function public.get_tribunal_results(bigint)
  to authenticated;

do $archives$
declare
  function_definition text := pg_get_functiondef(
    'public.get_tribunal_results_v2(bigint)'::regprocedure
  );
begin
  if position('result_question_id bigint;' in function_definition) > 0 then
    return;
  end if;

  if position('  question_id bigint;' in function_definition) = 0
     or position('    question_id := ' in function_definition) = 0
     or position('response.question_id = question_id' in function_definition) = 0 then
    raise exception 'La fonction de classement des archives du Tribunal a changé';
  end if;

  function_definition := replace(function_definition, '  question_id bigint;', '  result_question_id bigint;');
  function_definition := replace(function_definition, '    question_id := ', '    result_question_id := ');
  function_definition := replace(function_definition, 'response.question_id = question_id', 'response.question_id = result_question_id');
  execute function_definition;
end;
$archives$;

-- Version 3 keeps the existing anonymous aggregation and adds only aggregate
-- completion counters. No respondent identity or raw answer is returned.
create or replace function public.get_tribunal_results_v3(
  p_session_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  payload jsonb;
  selected_session_id bigint;
  completed_participants integer;
  total_participants integer;
begin
  if caller_id is null or not exists (
    select 1 from public.member_profiles profile where profile.id = caller_id
  ) then
    raise exception 'Authentification membre requise';
  end if;

  -- V2 delegates to the hardened base RPC, which enforces membership and the
  -- caller's completed_at state before returning anonymous aggregates.
  payload := public.get_tribunal_results_v2(p_session_id);
  selected_session_id := nullif(payload #>> '{session,id}', '')::bigint;

  if selected_session_id is null then
    raise exception 'Édition introuvable';
  end if;

  select
    count(*) filter (where participant.completed_at is not null)::integer,
    count(*)::integer
  into completed_participants, total_participants
  from public.tribunal_session_participants participant
  where participant.session_id = selected_session_id;

  return jsonb_set(
    payload,
    '{progress}',
    jsonb_build_object(
      'completedParticipants', completed_participants,
      'totalParticipants', total_participants,
      'isComplete', total_participants > 0
        and completed_participants = total_participants
    ),
    true
  );
end;
$$;

revoke all on function public.get_tribunal_results_v3(bigint)
  from public, anon, authenticated;
grant execute on function public.get_tribunal_results_v3(bigint)
  to authenticated;

create or replace function public.get_tribunal_context_v3(
  p_session_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  payload jsonb := public.get_tribunal_context_v2(p_session_id);
begin
  if coalesce((payload ->> 'isAdmin')::boolean, false) then
    return payload;
  end if;

  return jsonb_set(payload, '{sessions}', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', session.id,
      'title', session.title,
      'status', session.status
    ) order by session.created_at desc, session.id desc)
    from public.tribunal_session_participants participant
    join public.tribunal_sessions session on session.id = participant.session_id
    where participant.participant_id = caller_id
      and session.status <> 'draft'
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.get_tribunal_context_v3(bigint)
  from public, anon, authenticated;
grant execute on function public.get_tribunal_context_v3(bigint)
  to authenticated;

-- Raw answers remain unavailable through the Data API. Results are exposed only
-- through the authenticated aggregate RPCs above.
alter table public.tribunal_responses enable row level security;
revoke all on table public.tribunal_responses from public, anon, authenticated;
revoke update (
  target_participant_id, target_album_id, target_review_id, free_text
) on public.tribunal_responses from public, anon, authenticated;

-- Preserve roster reads without exposing an individual's completion timestamp.
revoke select on public.tribunal_session_participants from public, anon, authenticated;
grant select (session_id, participant_id, joined_at)
  on public.tribunal_session_participants to authenticated;
