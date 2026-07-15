-- Public ideas and private issue reports for DOL ZIKLUB.
create table if not exists public.club_ideas (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_username text not null,
  author_display_name text not null,
  content text not null check (char_length(btrim(content)) between 3 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists club_ideas_created_idx on public.club_ideas (created_at desc);

create table if not exists public.club_reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_username text not null,
  author_display_name text not null,
  category text not null check (category in ('bug', 'report')),
  subject text not null check (char_length(btrim(subject)) between 3 and 140),
  content text not null check (char_length(btrim(content)) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_reports_status_created_idx on public.club_reports (status, created_at desc);

create or replace function private.set_club_feedback_author()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile public.member_profiles%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  select * into profile
  from public.member_profiles
  where id = (select auth.uid());
  if not found then
    raise exception 'A member profile is required';
  end if;

  new.author_id := (select auth.uid());
  new.author_username := profile.username;
  new.author_display_name := profile.display_name;
  if tg_table_name = 'club_reports' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.set_club_feedback_author() from public, anon, authenticated;

drop trigger if exists set_club_idea_author on public.club_ideas;
create trigger set_club_idea_author
  before insert on public.club_ideas
  for each row execute function private.set_club_feedback_author();

drop trigger if exists set_club_report_author on public.club_reports;
create trigger set_club_report_author
  before insert on public.club_reports
  for each row execute function private.set_club_feedback_author();

create or replace function private.touch_club_report_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_club_report_updated_at() from public, anon, authenticated;

drop trigger if exists touch_club_report_updated_at on public.club_reports;
create trigger touch_club_report_updated_at
  before update on public.club_reports
  for each row execute function private.touch_club_report_updated_at();

alter table public.club_ideas enable row level security;
alter table public.club_reports enable row level security;

revoke all on table public.club_ideas from anon, authenticated;
grant select on table public.club_ideas to anon, authenticated;
grant insert, delete on table public.club_ideas to authenticated;

drop policy if exists "Anyone can read club ideas" on public.club_ideas;
create policy "Anyone can read club ideas"
  on public.club_ideas for select to anon, authenticated
  using (true);

drop policy if exists "Members can post club ideas" on public.club_ideas;
create policy "Members can post club ideas"
  on public.club_ideas for insert to authenticated
  with check ((select auth.uid()) = author_id);

drop policy if exists "Authors and admins can delete club ideas" on public.club_ideas;
create policy "Authors and admins can delete club ideas"
  on public.club_ideas for delete to authenticated
  using ((select auth.uid()) = author_id or (select private.is_member_admin()));

revoke all on table public.club_reports from anon, authenticated;
grant insert, select, update on table public.club_reports to authenticated;

drop policy if exists "Members can submit club reports" on public.club_reports;
create policy "Members can submit club reports"
  on public.club_reports for insert to authenticated
  with check ((select auth.uid()) = author_id);

drop policy if exists "Admins can read club reports" on public.club_reports;
create policy "Admins can read club reports"
  on public.club_reports for select to authenticated
  using ((select private.is_member_admin()));

drop policy if exists "Admins can update club reports" on public.club_reports;
create policy "Admins can update club reports"
  on public.club_reports for update to authenticated
  using ((select private.is_member_admin()))
  with check ((select private.is_member_admin()));