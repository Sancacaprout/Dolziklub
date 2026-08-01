alter table public.participant_badge_slots
  add column name text,
  add column description text,
  add column image_path text,
  add column rarity text;

alter table public.participant_badge_slots
  add constraint participant_badge_slots_name_check check (char_length(btrim(name)) between 2 and 80),
  add constraint participant_badge_slots_description_check check (char_length(btrim(description)) between 4 and 240),
  add constraint participant_badge_slots_image_check check (image_path ~ '^/badges/b(0[1-9]|1[0-9]|2[0-9])\.png$'),
  add constraint participant_badge_slots_rarity_check check (rarity in ('common','uncommon','rare','legendary'));

drop policy if exists "Members read their own badges" on public.participant_badges;
drop policy if exists "Administrators read all badges" on public.participant_badges;
create policy "Members or administrators read badges"
  on public.participant_badges for select to authenticated
  using (participant_id=(select auth.uid()) or (select private.is_member_admin()));

create or replace function public.set_my_equipped_badge(p_slot smallint,p_badge_key text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=(select auth.uid()); definition private.badge_definitions%rowtype;
begin
  if caller_id is null then raise exception 'Authentification membre requise'; end if;
  if p_slot not between 1 and 3 then raise exception 'Emplacement invalide'; end if;
  if p_badge_key is null then
    delete from public.participant_badge_slots where participant_id=caller_id and slot=p_slot;
  else
    if not exists(select 1 from public.participant_badges where participant_id=caller_id and badge_key=p_badge_key and claimed_at is not null) then
      raise exception 'Réclame ce badge avant de l’équiper';
    end if;
    select * into definition from private.badge_definitions where badge_key=p_badge_key and active;
    if definition.badge_key is null then raise exception 'Badge indisponible'; end if;
    delete from public.participant_badge_slots where participant_id=caller_id and badge_key=p_badge_key and slot<>p_slot;
    insert into public.participant_badge_slots(participant_id,slot,badge_key,name,description,image_path,rarity)
    values(caller_id,p_slot,p_badge_key,definition.name,definition.description,definition.image_path,definition.rarity)
    on conflict(participant_id,slot) do update set badge_key=excluded.badge_key,equipped_at=now(),
      name=excluded.name,description=excluded.description,image_path=excluded.image_path,rarity=excluded.rarity;
  end if;
  return public.get_my_badge_collection();
end;
$$;
revoke all on function public.set_my_equipped_badge(smallint,text) from public,anon;
grant execute on function public.set_my_equipped_badge(smallint,text) to authenticated;

create or replace function public.get_public_equipped_badges(p_participant_id uuid)
returns table(badge_key text,name text,description text,image_path text,rarity text,slot smallint)
language sql stable security invoker set search_path='' as $$
  select equipped.badge_key,equipped.name,equipped.description,equipped.image_path,equipped.rarity,equipped.slot
  from public.participant_badge_slots equipped where equipped.participant_id=p_participant_id order by equipped.slot;
$$;
revoke all on function public.get_public_equipped_badges(uuid) from public;
grant execute on function public.get_public_equipped_badges(uuid) to anon,authenticated;
