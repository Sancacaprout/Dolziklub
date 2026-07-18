-- Classic draws are created with a complete randomized proposer -> listener
-- permutation. The orientation matters: Enzo -> Axel is blocked later, while
-- Axel -> Enzo remains available.
drop function if exists public.admin_create_club_draw(text[], boolean, text, text);

create function public.admin_create_club_draw(
  p_participant_usernames text[],
  p_avoid_repeated_pairs boolean default true,
  p_draw_type text default 'standard',
  p_global_proposer_username text default null,
  p_legacy_forbidden_pairs text[] default '{}'::text[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_usernames text[];
  normalized_legacy_pairs text[];
  normalized_type text := lower(coalesce(nullif(btrim(p_draw_type), ''), 'standard'));
  normalized_global_proposer text := lower(nullif(btrim(p_global_proposer_username), ''));
  next_draw integer;
  global_proposer public.member_profiles%rowtype;
  proposer_ids uuid[];
  listener_ids uuid[];
  assignment_found boolean := false;
  attempt integer;
begin
  perform private.require_draw_admin();

  select array_agg(distinct lower(btrim(username)) order by lower(btrim(username)))
    into normalized_usernames
  from unnest(p_participant_usernames) as username
  where nullif(btrim(username), '') is not null;

  select coalesce(array_agg(distinct lower(btrim(pair))), '{}'::text[])
    into normalized_legacy_pairs
  from unnest(coalesce(p_legacy_forbidden_pairs, '{}'::text[])) as pair
  where nullif(btrim(pair), '') is not null;

  if cardinality(normalized_usernames) < 2 then
    raise exception 'At least two participants are required';
  end if;
  if cardinality(normalized_usernames) <> cardinality(p_participant_usernames) then
    raise exception 'Each participant must be selected only once';
  end if;
  if (select count(*) from public.member_profiles where lower(username) = any(normalized_usernames)) <> cardinality(normalized_usernames) then
    raise exception 'Unknown participant';
  end if;
  if normalized_type not in ('standard', 'global') then
    raise exception 'Unknown draw type';
  end if;

  if normalized_type = 'global' then
    if normalized_global_proposer is null or not (normalized_global_proposer = any(normalized_usernames)) then
      raise exception 'A global proposer must be selected among the participants';
    end if;
    select * into global_proposer
    from public.member_profiles
    where lower(username) = normalized_global_proposer;
    if global_proposer.id is null then
      raise exception 'Unknown global proposer';
    end if;
  else
    normalized_global_proposer := null;
  end if;

  select greatest(coalesce(max(draw_number), 0), 6) + 1
    into next_draw
  from public.club_draws;

  insert into public.club_draws (
    draw_number,
    participant_usernames,
    status,
    avoid_repeated_pairs,
    draw_type,
    global_proposer_username
  )
  values (
    next_draw,
    normalized_usernames,
    'draft',
    case when normalized_type = 'global' then false else coalesce(p_avoid_repeated_pairs, true) end,
    normalized_type,
    normalized_global_proposer
  );

  if normalized_type = 'global' then
    insert into public.club_draw_entries (
      draw_number,
      position,
      proposed_by,
      listened_by,
      proposed_by_name,
      listened_by_name
    )
    select
      next_draw,
      row_number() over (order by lower(listener.username))::integer,
      global_proposer.id,
      listener.id,
      global_proposer.username,
      listener.username
    from public.member_profiles as listener
    where lower(listener.username) = any(normalized_usernames)
      and listener.id <> global_proposer.id;
  else
    for attempt in 1..5000 loop
      select array_agg(profile.id order by random())
        into proposer_ids
      from public.member_profiles as profile
      where lower(profile.username) = any(normalized_usernames);

      select array_agg(profile.id order by random())
        into listener_ids
      from public.member_profiles as profile
      where lower(profile.username) = any(normalized_usernames);

      select not exists (
        select 1
        from generate_subscripts(proposer_ids, 1) as slot(position)
        join public.member_profiles as proposer on proposer.id = proposer_ids[slot.position]
        join public.member_profiles as listener on listener.id = listener_ids[slot.position]
        where proposer.id = listener.id
          or (
            coalesce(p_avoid_repeated_pairs, true)
            and (
              lower(proposer.username) || '|' || lower(listener.username) = any(normalized_legacy_pairs)
              or exists (
                select 1
                from public.club_draw_entries as earlier_entry
                join public.club_draws as earlier_draw on earlier_draw.draw_number = earlier_entry.draw_number
                where earlier_draw.status in ('published', 'locked')
                  and earlier_entry.proposed_by = proposer.id
                  and earlier_entry.listened_by = listener.id
              )
            )
          )
      ) into assignment_found;

      exit when assignment_found;
    end loop;

    if not assignment_found then
      raise exception 'Impossible to generate a classic draw with the selected participants and their pairing history';
    end if;

    insert into public.club_draw_entries (
      draw_number,
      position,
      proposed_by,
      listened_by,
      proposed_by_name,
      listened_by_name
    )
    select
      next_draw,
      slot.position,
      proposer.id,
      listener.id,
      proposer.username,
      listener.username
    from generate_subscripts(proposer_ids, 1) as slot(position)
    join public.member_profiles as proposer on proposer.id = proposer_ids[slot.position]
    join public.member_profiles as listener on listener.id = listener_ids[slot.position]
    order by slot.position;
  end if;

  return next_draw;
end;
$$;

revoke all on function public.admin_create_club_draw(text[], boolean, text, text, text[]) from public, anon;
grant execute on function public.admin_create_club_draw(text[], boolean, text, text, text[]) to authenticated;