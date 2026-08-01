create or replace function private.evaluate_badges_after_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare participant uuid; proposer uuid; reference text;
begin
  if tg_table_name='club_draw_entries' then participant:=new.proposed_by; reference:=new.id::text;
  elsif tg_table_name='member_album_reviews' then
    participant:=new.member_id; reference:=new.id::text;
    select entry.proposed_by into proposer from public.club_draw_entries entry where entry.id::text=new.album_id;
  elsif tg_table_name='archived_album_reviews' then
    reference:=new.album_id;
    select listener.id,proposer_profile.id into participant,proposer
    from private.tribunal_archive_albums archive
    left join public.member_profiles listener on lower(listener.username)=lower(archive.listened_by_name)
    left join public.member_profiles proposer_profile on lower(proposer_profile.username)=lower(archive.proposed_by_name)
    where archive.id=new.album_id;
  elsif tg_table_name='bonus_album_reviews' then participant:=new.member_id; reference:=new.id::text;
  elsif tg_table_name='extra_listening_requests' then
    if new.status<>'reviewed' then return new; end if;
    participant:=new.requester_id; proposer:=new.proposer_id; reference:=new.id::text;
  end if;
  perform private.evaluate_badges(participant,tg_table_name,reference,false);
  if proposer is not null and proposer is distinct from participant then
    perform private.evaluate_badges(proposer,tg_table_name,reference,false);
  end if;
  return new;
end;
$$;
revoke all on function private.evaluate_badges_after_activity() from public,anon,authenticated;

create trigger badge_evaluate_proposal after insert or update of album_title,album_artist,proposed_by on public.club_draw_entries
  for each row when(new.album_title is not null and new.album_artist is not null) execute function private.evaluate_badges_after_activity();
create trigger badge_evaluate_live_review after insert or update of review_title,review,rating,best_track,worst_track on public.member_album_reviews
  for each row execute function private.evaluate_badges_after_activity();
create trigger badge_evaluate_archive_review after update of review_title,review,rating,best_track,worst_track on public.archived_album_reviews
  for each row execute function private.evaluate_badges_after_activity();
create trigger badge_evaluate_bonus_review after insert or update of review_title,review,rating,best_track,worst_track on public.bonus_album_reviews
  for each row execute function private.evaluate_badges_after_activity();
create trigger badge_evaluate_extra_review after insert or update of status,review_title,review,rating,best_track,worst_track on public.extra_listening_requests
  for each row when(new.status='reviewed') execute function private.evaluate_badges_after_activity();

create or replace function private.evaluate_wheely_badges()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.achievement_key='wheely-theme' then
    perform private.unlock_badge(new.participant_id,'b24','wheely',new.detail->>'run_id',jsonb_build_object('achievementKey',new.achievement_key));
    perform private.unlock_badge(new.participant_id,'b25','wheely',new.detail->>'run_id',jsonb_build_object('achievementKey',new.achievement_key));
  end if;
  return new;
end;
$$;
revoke all on function private.evaluate_wheely_badges() from public,anon,authenticated;
create trigger badge_evaluate_wheely after insert or update on public.participant_achievements
  for each row execute function private.evaluate_wheely_badges();

create or replace function private.evaluate_tribunal_badges(p_session_id bigint)
returns integer language plpgsql security definer set search_path='' as $$
declare winner record; awarded integer:=0;
begin
  if not exists(select 1 from public.tribunal_sessions where id=p_session_id and status in('closed','results_revealed')) then return 0; end if;
  for winner in
    with citations as(
      select response.target_participant_id participant_id,count(*)::integer total
      from public.tribunal_responses response join public.tribunal_questions question on question.id=response.question_id
      where response.session_id=p_session_id and not response.is_hidden and question.type in('member','member_text')
        and response.target_participant_id is not null group by response.target_participant_id
    ) select * from citations where total=(select max(total) from citations) and total>0
  loop
    if private.unlock_badge(winner.participant_id,'b26','tribunal',p_session_id::text,
      jsonb_build_object('citations',winner.total,'sessionId',p_session_id)) then awarded:=awarded+1; end if;
  end loop;
  return awarded;
end;
$$;
revoke all on function private.evaluate_tribunal_badges(bigint) from public,anon,authenticated;

create or replace function private.evaluate_tribunal_badges_after_close()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in('closed','results_revealed') and old.status is distinct from new.status then
    perform private.evaluate_tribunal_badges(new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.evaluate_tribunal_badges_after_close() from public,anon,authenticated;
create trigger badge_evaluate_tribunal after update of status on public.tribunal_sessions
  for each row execute function private.evaluate_tribunal_badges_after_close();

create or replace function public.get_my_badge_collection()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=(select auth.uid()); snapshot jsonb; payload jsonb;
begin
  if caller_id is null or not exists(select 1 from public.member_public_profiles where id=caller_id) then
    raise exception 'Authentification membre requise';
  end if;
  perform private.evaluate_badges(caller_id,'collection-opened',null,false);
  snapshot:=private.badge_snapshot(caller_id);
  select jsonb_build_object(
    'badges',coalesce(jsonb_agg(jsonb_build_object(
      'key',definition.badge_key,
      'name',case when definition.is_secret and earned.badge_key is null then 'Badge secret' else definition.name end,
      'description',case when definition.is_secret and earned.badge_key is null then 'Condition secrète.' else definition.description end,
      'imagePath',case when definition.is_secret and earned.badge_key is null then null else definition.image_path end,
      'category',definition.category,'rarity',definition.rarity,'secret',definition.is_secret,
      'state',case when slot.badge_key is not null then 'equipped' when earned.claimed_at is not null then 'claimed'
        when earned.badge_key is not null then 'unlocked_unclaimed' else 'locked' end,
      'unlockedAt',earned.unlocked_at,'claimedAt',earned.claimed_at,'slot',slot.slot,
      'progress',case when definition.is_secret and earned.badge_key is null then null else jsonb_build_object(
        'current',case definition.badge_key
          when 'b01' then snapshot->'proposalCount' when 'b02' then snapshot->'proposalCount' when 'b03' then snapshot->'proposalCount' when 'b04' then snapshot->'proposalCount'
          when 'b05' then snapshot->'proposalGe4Count' when 'b06' then snapshot->'proposalLe1Count' when 'b07' then snapshot->'proposalLe2Count' when 'b08' then snapshot->'proposal5Count'
          when 'b09' then snapshot->'officialCount' when 'b10' then snapshot->'officialCount' when 'b11' then snapshot->'officialCount' when 'b12' then snapshot->'totalCount'
          when 'b13' then snapshot->'extraCount' when 'b14' then snapshot->'extraCount' when 'b15' then snapshot->'onTimeStreak'
          when 'b16' then snapshot->'completeCount' when 'b17' then snapshot->'completeCount' when 'b18' then snapshot->'rating5Count' when 'b19' then snapshot->'ratingLowCount'
          when 'b20' then snapshot->'ratingCount' when 'b21' then to_jsonb((case when(snapshot->>'hasRating5')::boolean then 1 else 0 end)+(case when(snapshot->>'hasRating1')::boolean then 1 else 0 end))
          when 'b22' then snapshot->'ratingCount' when 'b23' then snapshot->'ratingCount'
          when 'b24' then to_jsonb(case when earned.badge_key is null then 0 else 1 end) when 'b25' then to_jsonb(case when earned.badge_key is null then 0 else 1 end)
          when 'b26' then to_jsonb(case when earned.badge_key is null then 0 else 1 end) when 'b27' then snapshot->'expressCount'
          when 'b28' then snapshot->'lastMinuteCount' when 'b29' then snapshot->'revenantCount' end,
        'target',definition.progress_target) end
    ) order by definition.display_order),'[]'::jsonb),
    'equippedCount',count(slot.badge_key),'unclaimedCount',count(*) filter(where earned.badge_key is not null and earned.claimed_at is null)
  ) into payload
  from private.badge_definitions definition
  left join public.participant_badges earned on earned.participant_id=caller_id and earned.badge_key=definition.badge_key
  left join public.participant_badge_slots slot on slot.participant_id=caller_id and slot.badge_key=definition.badge_key
  where definition.active;
  return payload;
end;
$$;
revoke all on function public.get_my_badge_collection() from public,anon;
grant execute on function public.get_my_badge_collection() to authenticated;

create or replace function public.claim_my_badge(p_badge_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=(select auth.uid()); claimed public.participant_badges%rowtype;
begin
  if caller_id is null then raise exception 'Authentification membre requise'; end if;
  update public.participant_badges set claimed_at=coalesce(claimed_at,now())
  where participant_id=caller_id and badge_key=p_badge_key returning * into claimed;
  if claimed.badge_key is null then raise exception 'Ce badge n’est pas débloqué'; end if;
  return jsonb_build_object('key',claimed.badge_key,'claimedAt',claimed.claimed_at);
end;
$$;
revoke all on function public.claim_my_badge(text) from public,anon;
grant execute on function public.claim_my_badge(text) to authenticated;

create or replace function public.set_my_equipped_badge(p_slot smallint,p_badge_key text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=(select auth.uid());
begin
  if caller_id is null then raise exception 'Authentification membre requise'; end if;
  if p_slot not between 1 and 3 then raise exception 'Emplacement invalide'; end if;
  if p_badge_key is null then delete from public.participant_badge_slots where participant_id=caller_id and slot=p_slot;
  else
    if not exists(select 1 from public.participant_badges where participant_id=caller_id and badge_key=p_badge_key and claimed_at is not null) then
      raise exception 'Réclame ce badge avant de l’équiper'; end if;
    delete from public.participant_badge_slots where participant_id=caller_id and badge_key=p_badge_key and slot<>p_slot;
    insert into public.participant_badge_slots(participant_id,slot,badge_key) values(caller_id,p_slot,p_badge_key)
    on conflict(participant_id,slot) do update set badge_key=excluded.badge_key,equipped_at=now();
  end if;
  return public.get_my_badge_collection();
end;
$$;
revoke all on function public.set_my_equipped_badge(smallint,text) from public,anon;
grant execute on function public.set_my_equipped_badge(smallint,text) to authenticated;

create or replace function public.get_public_equipped_badges(p_participant_id uuid)
returns table(badge_key text,name text,description text,image_path text,rarity text,slot smallint)
language sql stable security definer set search_path='' as $$
  select definition.badge_key,definition.name,definition.description,definition.image_path,definition.rarity,equipped.slot
  from public.participant_badge_slots equipped
  join public.participant_badges earned on earned.participant_id=equipped.participant_id and earned.badge_key=equipped.badge_key
  join private.badge_definitions definition on definition.badge_key=equipped.badge_key
  where equipped.participant_id=p_participant_id and earned.claimed_at is not null and definition.active order by equipped.slot;
$$;
revoke all on function public.get_public_equipped_badges(uuid) from public;
grant execute on function public.get_public_equipped_badges(uuid) to anon,authenticated;

do $backfill$
declare profile record; achievement record; session record;
begin
  for profile in select id from public.member_public_profiles loop
    perform private.evaluate_badges(profile.id,'historical-backfill',null,true);
  end loop;
  for achievement in select participant_id,detail from public.participant_achievements where achievement_key='wheely-theme' loop
    perform private.unlock_badge(achievement.participant_id,'b24','wheely-backfill',achievement.detail->>'run_id',jsonb_build_object('retroactive',true));
    perform private.unlock_badge(achievement.participant_id,'b25','wheely-backfill',achievement.detail->>'run_id',jsonb_build_object('retroactive',true));
  end loop;
  for session in select id from public.tribunal_sessions where status in('closed','results_revealed') loop
    perform private.evaluate_tribunal_badges(session.id);
  end loop;
end;
$backfill$;
