create or replace function private.badge_snapshot(p_participant_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
with identity as (
  select lower(profile.username) username from public.member_profiles profile where profile.id=p_participant_id
), proposed_verdicts as (
  select archive.id album_key, review.rating
  from private.tribunal_archive_albums archive
  join public.archived_album_reviews review on review.album_id=archive.id cross join identity
  where lower(archive.proposed_by_name)=identity.username and review.rating is not null
  union all
  select 'live:'||coalesce(entry.archive_number::text,entry.draw_number::text||':'||lower(entry.album_title)||':'||lower(entry.album_artist)),review.rating
  from public.club_draw_entries entry join public.member_album_reviews review on review.album_id=entry.id::text
  where entry.proposed_by=p_participant_id and (entry.archive_number is null or entry.archive_number>49) and review.rating is not null
), proposed_albums as (
  select album_key,bool_or(rating>=4) has_ge4,bool_or(rating<=1) has_le1,
    bool_or(rating<=2) has_le2,bool_or(rating=5) has_5 from proposed_verdicts group by album_key
), all_proposals as (
  select archive.id album_key from private.tribunal_archive_albums archive cross join identity
  where lower(archive.proposed_by_name)=identity.username
  union
  select 'live:'||coalesce(entry.archive_number::text,entry.draw_number::text||':'||lower(entry.album_title)||':'||lower(entry.album_artist))
  from public.club_draw_entries entry where entry.proposed_by=p_participant_id
    and nullif(btrim(entry.album_title),'') is not null and nullif(btrim(entry.album_artist),'') is not null
    and (entry.archive_number is null or entry.archive_number>49)
), reviews as (
  select 'official'::text kind,archive.id review_key,review.review_title,review.review,review.rating,
    review.best_track,review.worst_track,null::timestamptz submitted_at,null::timestamptz assigned_at,null::timestamptz deadline_at
  from public.archived_album_reviews review join private.tribunal_archive_albums archive on archive.id=review.album_id cross join identity
  where lower(archive.listened_by_name)=identity.username and review.rating is not null
  union all
  select 'official','live:'||review.id::text,review.review_title,review.review,review.rating,
    review.best_track,review.worst_track,review.created_at,draw.created_at,draw.created_at+interval '7 days'
  from public.member_album_reviews review join public.club_draw_entries entry on entry.id::text=review.album_id
  join public.club_draws draw on draw.draw_number=entry.draw_number
  where review.member_id=p_participant_id and (entry.archive_number is null or entry.archive_number>49)
  union all
  select 'bonus','bonus:'||bonus.id::text,bonus.review_title,bonus.review,bonus.rating,
    bonus.best_track,bonus.worst_track,bonus.created_at,null,null
  from public.bonus_album_reviews bonus where bonus.member_id=p_participant_id
  union all
  select 'extra','extra:'||extra.id::text,extra.review_title,extra.review,extra.rating,
    extra.best_track,extra.worst_track,extra.reviewed_at,extra.requested_at,draw.created_at+interval '7 days'
  from public.extra_listening_requests extra join public.club_draws draw on draw.draw_number=extra.draw_number
  where extra.requester_id=p_participant_id and extra.status='reviewed'
), review_stats as (
  select count(*) filter(where kind='official')::integer official_count,count(*)::integer total_count,
    count(*) filter(where kind in('bonus','extra'))::integer extra_count,
    count(*) filter(where nullif(btrim(review_title),'') is not null and nullif(btrim(review),'') is not null
      and rating is not null and nullif(btrim(best_track),'') is not null and nullif(btrim(worst_track),'') is not null)::integer complete_count,
    count(*) filter(where rating=5)::integer rating_5_count,count(*) filter(where rating<=1.5)::integer rating_low_count,
    count(*) filter(where rating is not null)::integer rating_count,avg(rating) filter(where rating is not null) rating_average,
    bool_or(rating=5) has_rating_5,bool_or(rating=1) has_rating_1 from reviews
), launch as (select launched_at from private.badge_system_state where singleton), temporal as (
  select count(*) filter(where kind='official' and assigned_at>=launch.launched_at and submitted_at between assigned_at and assigned_at+interval '24 hours')::integer express_count,
    count(*) filter(where deadline_at is not null and assigned_at>=launch.launched_at and submitted_at between deadline_at-interval '24 hours' and deadline_at)::integer last_minute_count,
    count(*) filter(where kind='official' and deadline_at is not null and assigned_at>=launch.launched_at and submitted_at>=deadline_at+interval '30 days')::integer revenant_count
  from reviews cross join launch
), settled_assignments as (
  select entry.id,entry.draw_number,entry.position,(review.created_at is not null and review.created_at<=draw.created_at+interval '7 days') on_time,
    row_number() over(order by entry.draw_number desc,entry.position desc) sequence
  from public.club_draw_entries entry join public.club_draws draw on draw.draw_number=entry.draw_number cross join launch
  left join public.member_album_reviews review on review.album_id=entry.id::text and review.member_id=p_participant_id
  where entry.listened_by=p_participant_id and draw.created_at>=launch.launched_at
    and (review.id is not null or draw.created_at+interval '7 days'<=now())
), streak as (
  select count(*)::integer on_time_streak from settled_assignments
  where on_time and sequence<coalesce((select min(sequence) from settled_assignments where not on_time),2147483647)
)
select jsonb_build_object(
  'proposalCount',(select count(*) from all_proposals),'proposalGe4Count',(select count(*) from proposed_albums where has_ge4),
  'proposalLe1Count',(select count(*) from proposed_albums where has_le1),'proposalLe2Count',(select count(*) from proposed_albums where has_le2),
  'proposal5Count',(select count(*) from proposed_albums where has_5),'officialCount',coalesce(review_stats.official_count,0),
  'totalCount',coalesce(review_stats.total_count,0),'extraCount',coalesce(review_stats.extra_count,0),
  'completeCount',coalesce(review_stats.complete_count,0),'rating5Count',coalesce(review_stats.rating_5_count,0),
  'ratingLowCount',coalesce(review_stats.rating_low_count,0),'ratingCount',coalesce(review_stats.rating_count,0),
  'ratingAverage',review_stats.rating_average,'hasRating5',coalesce(review_stats.has_rating_5,false),
  'hasRating1',coalesce(review_stats.has_rating_1,false),'onTimeStreak',coalesce(streak.on_time_streak,0),
  'expressCount',coalesce(temporal.express_count,0),'lastMinuteCount',coalesce(temporal.last_minute_count,0),
  'revenantCount',coalesce(temporal.revenant_count,0)
) from review_stats cross join temporal cross join streak;
$$;
revoke all on function private.badge_snapshot(uuid) from public,anon,authenticated;

create or replace function private.unlock_badge(p_participant_id uuid,p_badge_key text,p_source text,
  p_source_reference text default null,p_detail jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare badge private.badge_definitions%rowtype; inserted_key text;
begin
  if p_participant_id is null then return false; end if;
  select * into badge from private.badge_definitions where badge_key=p_badge_key and active;
  if badge.badge_key is null then raise exception 'Unknown badge'; end if;
  insert into public.participant_badges(participant_id,badge_key,unlock_source,source_reference,detail)
  values(p_participant_id,badge.badge_key,p_source,p_source_reference,coalesce(p_detail,'{}'::jsonb))
  on conflict(participant_id,badge_key) do nothing returning badge_key into inserted_key;
  if inserted_key is null then return false; end if;
  insert into public.member_notifications(recipient_id,kind,title,body,href)
  values(p_participant_id,'badge','Nouveau badge débloqué',case when badge.is_secret then 'Un badge secret vient d’être révélé.'
    else 'Tu as débloqué « '||badge.name||' ».' end,'/compte?badge='||badge.badge_key);
  return true;
end;
$$;
revoke all on function private.unlock_badge(uuid,text,text,text,jsonb) from public,anon,authenticated;

create or replace function private.evaluate_badges(p_participant_id uuid,p_source text default 'activity',
  p_source_reference text default null,p_retroactive boolean default false)
returns integer language plpgsql security definer set search_path='' as $$
declare s jsonb; unlocked integer:=0; detail jsonb:=jsonb_build_object('retroactive',p_retroactive);
begin
  if p_participant_id is null or not exists(select 1 from public.member_public_profiles where id=p_participant_id) then return 0; end if;
  s:=private.badge_snapshot(p_participant_id);
  if (s->>'proposalCount')::int>=1 and private.unlock_badge(p_participant_id,'b01',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'proposalCount')::int>=5 and private.unlock_badge(p_participant_id,'b02',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'proposalCount')::int>=20 and private.unlock_badge(p_participant_id,'b03',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'proposalCount')::int>=30 and private.unlock_badge(p_participant_id,'b04',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'proposalGe4Count')::int>=3 and private.unlock_badge(p_participant_id,'b05',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'proposalLe1Count')::int>=1 and private.unlock_badge(p_participant_id,'b06',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'proposalLe2Count')::int>=3 and private.unlock_badge(p_participant_id,'b07',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'proposal5Count')::int>=3 and private.unlock_badge(p_participant_id,'b08',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'officialCount')::int>=1 and private.unlock_badge(p_participant_id,'b09',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'officialCount')::int>=5 and private.unlock_badge(p_participant_id,'b10',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'officialCount')::int>=20 and private.unlock_badge(p_participant_id,'b11',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'totalCount')::int>=30 and private.unlock_badge(p_participant_id,'b12',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'extraCount')::int>=1 and private.unlock_badge(p_participant_id,'b13',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'extraCount')::int>=5 and private.unlock_badge(p_participant_id,'b14',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'onTimeStreak')::int>=10 and private.unlock_badge(p_participant_id,'b15',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'completeCount')::int>=10 and private.unlock_badge(p_participant_id,'b16',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'completeCount')::int>=25 and private.unlock_badge(p_participant_id,'b17',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'rating5Count')::int>=3 and private.unlock_badge(p_participant_id,'b18',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'ratingLowCount')::int>=3 and private.unlock_badge(p_participant_id,'b19',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'ratingCount')::int>=10 and (s->>'ratingAverage')::numeric between 2.9 and 3.1 and private.unlock_badge(p_participant_id,'b20',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'hasRating5')::boolean and (s->>'hasRating1')::boolean and private.unlock_badge(p_participant_id,'b21',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'ratingCount')::int>=10 and (s->>'ratingAverage')::numeric<2.5 and private.unlock_badge(p_participant_id,'b22',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'ratingCount')::int>=10 and (s->>'ratingAverage')::numeric>3.8 and private.unlock_badge(p_participant_id,'b23',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'expressCount')::int>=1 and private.unlock_badge(p_participant_id,'b27',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'lastMinuteCount')::int>=3 and private.unlock_badge(p_participant_id,'b28',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  if (s->>'revenantCount')::int>=1 and private.unlock_badge(p_participant_id,'b29',p_source,p_source_reference,detail) then unlocked:=unlocked+1; end if;
  return unlocked;
end;
$$;
revoke all on function private.evaluate_badges(uuid,text,text,boolean) from public,anon,authenticated;
