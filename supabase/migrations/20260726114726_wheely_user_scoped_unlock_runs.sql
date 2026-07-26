create table if not exists public.wheely_unlock_runs (
  participant_id uuid primary key references public.member_public_profiles(id) on delete cascade,
  run_id uuid not null unique,
  started_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.wheely_unlock_runs enable row level security;
revoke all on table public.wheely_unlock_runs from public, anon, authenticated;
grant select, insert, update on table public.wheely_unlock_runs to authenticated;
grant select, insert, update, delete on table public.wheely_unlock_runs to service_role;

drop policy if exists "Members read their own Wheely run" on public.wheely_unlock_runs;
create policy "Members read their own Wheely run"
  on public.wheely_unlock_runs for select to authenticated
  using (participant_id = (select auth.uid()));

drop policy if exists "Members start their own Wheely run" on public.wheely_unlock_runs;
create policy "Members start their own Wheely run"
  on public.wheely_unlock_runs for insert to authenticated
  with check (
    participant_id = (select auth.uid())
    and started_at between statement_timestamp() - interval '15 seconds'
                       and statement_timestamp() + interval '15 seconds'
  );

drop policy if exists "Members restart their own Wheely run" on public.wheely_unlock_runs;
create policy "Members restart their own Wheely run"
  on public.wheely_unlock_runs for update to authenticated
  using (participant_id = (select auth.uid()))
  with check (
    participant_id = (select auth.uid())
    and started_at between statement_timestamp() - interval '15 seconds'
                       and statement_timestamp() + interval '15 seconds'
  );

grant insert on table public.participant_achievements to authenticated;

drop policy if exists "Members unlock Wheely after a complete run" on public.participant_achievements;
create policy "Members unlock Wheely after a complete run"
  on public.participant_achievements for insert to authenticated
  with check (
    participant_id = (select auth.uid())
    and achievement_key = 'wheely-theme'
    and exists (
      select 1
      from public.wheely_unlock_runs run
      where run.participant_id = (select auth.uid())
        and run.run_id::text = detail ->> 'run_id'
        and run.started_at <= statement_timestamp() - interval '72 seconds'
        and run.started_at >= statement_timestamp() - interval '30 minutes'
    )
  );

update public.site_updates
set content = jsonb_set(
  content,
  '{fixed,0,text}',
  to_jsonb(U&'Le d\00E9blocage utilise maintenant une partie horodat\00E9e par Supabase et la session authentifi\00E9e du joueur, sans aucune cl\00E9 administrateur dans Vercel.'::text)
)
where id = 'wheely-real-finale-unlock-fix';
