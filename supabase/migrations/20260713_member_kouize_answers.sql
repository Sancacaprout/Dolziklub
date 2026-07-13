-- Public Kouize answers. Members may change only their own column;
-- administrators are deliberately read-only, including for their own answers.

create table if not exists public.member_kouize_answers (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  member_username text not null check (member_username ~ '^[a-z0-9_-]{2,80}$'),
  question_key text not null check (question_key in ('default_style', 'dislikes', 'curiosity', 'first_hook')),
  answer text not null check (char_length(btrim(answer)) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, question_key)
);

create index if not exists member_kouize_answers_question_key_idx
  on public.member_kouize_answers (question_key);

alter table public.member_kouize_answers enable row level security;

grant select on table public.member_kouize_answers to anon, authenticated;
grant insert, update on table public.member_kouize_answers to authenticated;

drop policy if exists "Kouize answers are publicly readable" on public.member_kouize_answers;
create policy "Kouize answers are publicly readable"
  on public.member_kouize_answers for select to anon, authenticated
  using (true);

drop policy if exists "Members can add their own Kouize answers" on public.member_kouize_answers;
create policy "Members can add their own Kouize answers"
  on public.member_kouize_answers for insert to authenticated
  with check (
    (select auth.uid()) = member_id
    and not (select private.is_member_admin())
    and member_username = (
      select username from public.member_profiles where id = (select auth.uid())
    )
  );

drop policy if exists "Members can update their own Kouize answers" on public.member_kouize_answers;
create policy "Members can update their own Kouize answers"
  on public.member_kouize_answers for update to authenticated
  using (
    (select auth.uid()) = member_id
    and not (select private.is_member_admin())
  )
  with check (
    (select auth.uid()) = member_id
    and not (select private.is_member_admin())
    and member_username = (
      select username from public.member_profiles where id = (select auth.uid())
    )
  );

create or replace function private.touch_member_kouize_answer()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_member_kouize_answer() from public, anon, authenticated;

drop trigger if exists member_kouize_answers_touch_updated_at on public.member_kouize_answers;
create trigger member_kouize_answers_touch_updated_at
  before update on public.member_kouize_answers
  for each row execute procedure private.touch_member_kouize_answer();

insert into public.member_kouize_answers (member_id, member_username, question_key, answer)
select profile.id, source.username, source.question_key, source.answer
from (
  values
    ('thomas', 'default_style', 'Rap'), ('pep', 'default_style', '—'), ('motem', 'default_style', 'Tout'), ('bono', 'default_style', '—'), ('dod', 'default_style', 'Rock — puis n’importe quoi'), ('yuna', 'default_style', 'Pop — rap de la street bof'), ('chacha', 'default_style', 'Rock'), ('enzo', 'default_style', '—'), ('kougna', 'default_style', 'Hip-hop — et le rock en 2e'), ('alain', 'default_style', 'Instrumental'),
    ('thomas', 'dislikes', 'Métal'), ('pep', 'dislikes', '—'), ('motem', 'dislikes', 'Autotune bien dégueu'), ('bono', 'dislikes', '—'), ('dod', 'dislikes', 'Classique'), ('yuna', 'dislikes', 'Rap — rap de la street bof'), ('chacha', 'dislikes', '—'), ('enzo', 'dislikes', '—'), ('kougna', 'dislikes', 'Il y a du bon dans tout'), ('alain', 'dislikes', 'Rap'),
    ('thomas', 'curiosity', 'Jazz'), ('pep', 'curiosity', 'Musique mongole'), ('motem', 'curiosity', '—'), ('bono', 'curiosity', '—'), ('dod', 'curiosity', 'Folk'), ('yuna', 'curiosity', 'Expérimental'), ('chacha', 'curiosity', 'Jazz'), ('enzo', 'curiosity', '—'), ('kougna', 'curiosity', 'Autre — tout'), ('alain', 'curiosity', '—'),
    ('thomas', 'first_hook', 'La mélodie — la prod intrigue, les paroles font rester'), ('pep', 'first_hook', 'L’ambiance — les émotions frr'), ('motem', 'first_hook', '—'), ('bono', 'first_hook', '—'), ('dod', 'first_hook', 'La mélodie — plus précisément les suites d’accords'), ('yuna', 'first_hook', 'La mélodie'), ('chacha', 'first_hook', 'La rythmique'), ('enzo', 'first_hook', '—'), ('kougna', 'first_hook', 'L’ambiance'), ('alain', 'first_hook', 'L’ambiance — une musique avec une âme, les changements de tonalité qui surprennent')
) as source(username, question_key, answer)
join public.member_profiles as profile on profile.username = source.username
on conflict (member_id, question_key) do nothing;
