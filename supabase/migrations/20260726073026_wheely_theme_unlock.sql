-- Account-bound unlocks for profile rewards. Wheely is the first achievement.
create table if not exists public.participant_achievements (
  participant_id uuid not null references public.member_public_profiles(id) on delete cascade,
  achievement_key text not null check (achievement_key ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  unlocked_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  primary key (participant_id, achievement_key)
);

alter table public.participant_achievements enable row level security;
revoke all on public.participant_achievements from anon, authenticated;
grant select on public.participant_achievements to authenticated;

drop policy if exists "Members read their own achievements" on public.participant_achievements;
create policy "Members read their own achievements"
  on public.participant_achievements for select to authenticated
  using (participant_id = (select auth.uid()));

drop policy if exists "Administrators read all achievements" on public.participant_achievements;
create policy "Administrators read all achievements"
  on public.participant_achievements for select to authenticated
  using ((select private.is_member_admin()));

-- Anyone who had already equipped Wheely keeps it and receives the achievement.
insert into public.participant_achievements (participant_id, achievement_key, unlocked_at, detail)
select
  id,
  'wheely-theme',
  coalesce(profile_theme_selected_at, now()),
  jsonb_build_object('source', 'legacy-equipped-theme')
from public.member_public_profiles
where profile_theme = 'wheely'
on conflict (participant_id, achievement_key) do nothing;

-- This trigger is the final authorization boundary, including direct REST calls.
create or replace function private.enforce_profile_theme_unlock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.profile_theme = 'wheely'
     and (tg_op = 'INSERT' or old.profile_theme is distinct from new.profile_theme)
     and not private.is_member_admin()
     and not exists (
       select 1
       from public.participant_achievements achievement
       where achievement.participant_id = new.id
         and achievement.achievement_key = 'wheely-theme'
     ) then
    raise exception 'Termine le mini-jeu Wheely avant d''équiper ce thème.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_profile_theme_unlock() from public, anon, authenticated;

drop trigger if exists member_public_profiles_enforce_theme_unlock on public.member_public_profiles;
create trigger member_public_profiles_enforce_theme_unlock
  before insert or update of profile_theme on public.member_public_profiles
  for each row execute function private.enforce_profile_theme_unlock();

-- Profile theme changes use the normal RLS policy and the unlock trigger above.
create or replace function public.save_my_profile_theme(p_theme text)
returns table (saved_theme text, selected_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;

  return query
  update public.member_public_profiles profile
  set profile_theme = p_theme,
      profile_theme_selected_at = now()
  where profile.id = (select auth.uid())
  returning profile.profile_theme, profile.profile_theme_selected_at;

  if not found then
    raise exception 'Profil membre introuvable.';
  end if;
end;
$$;
revoke all on function public.save_my_profile_theme(text) from public, anon;
grant execute on function public.save_my_profile_theme(text) to authenticated;