-- A seven-day informational deadline starts when each draw is created.
-- Reminders are generated in Postgres so they do not depend on an open browser.
create extension if not exists pg_cron;

create table if not exists private.draw_reminder_deliveries (
  draw_number integer not null references public.club_draws(draw_number) on delete cascade,
  entry_id uuid not null references public.club_draw_entries(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('missing_album_halfway', 'missing_review_last_day')),
  sent_at timestamptz not null default now(),
  primary key (draw_number, entry_id, recipient_id, reminder_type)
);

alter table private.draw_reminder_deliveries enable row level security;
revoke all on table private.draw_reminder_deliveries from public, anon, authenticated;

create or replace function private.send_draw_deadline_reminders()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  proposal_count integer := 0;
  review_count integer := 0;
begin
  with claimed as (
    insert into private.draw_reminder_deliveries (
      draw_number, entry_id, recipient_id, reminder_type
    )
    select
      draw.draw_number,
      entry.id,
      entry.proposed_by,
      'missing_album_halfway'
    from public.club_draws as draw
    join public.club_draw_entries as entry
      on entry.draw_number = draw.draw_number
    where draw.status = 'published'
      and now() >= draw.created_at + interval '3 days 12 hours'
      and now() < draw.created_at + interval '7 days'
      and entry.proposed_by is not null
      and (
        nullif(btrim(entry.album_title), '') is null
        or nullif(btrim(entry.album_artist), '') is null
      )
    on conflict do nothing
    returning entry_id, recipient_id
  )
  insert into public.member_notifications (
    recipient_id, kind, title, body, href
  )
  select
    claimed.recipient_id,
    'task',
    'Mi-parcours · album à proposer',
    'La moitié des sept jours du tirage est passée. Ajoute ton album pour ' ||
      coalesce(
        (select coalesce(nullif(btrim(profile.display_name), ''), profile.username)
           from public.member_profiles as profile
          where profile.id = entry.listened_by),
        entry.listened_by_name,
        'ton binôme'
      ) || '.',
    '/tableur?proposal=' || entry.id::text
  from claimed
  join public.club_draw_entries as entry on entry.id = claimed.entry_id;

  get diagnostics proposal_count = row_count;

  with claimed as (
    insert into private.draw_reminder_deliveries (
      draw_number, entry_id, recipient_id, reminder_type
    )
    select
      draw.draw_number,
      entry.id,
      entry.listened_by,
      'missing_review_last_day'
    from public.club_draws as draw
    join public.club_draw_entries as entry
      on entry.draw_number = draw.draw_number
    where draw.status = 'published'
      and now() >= draw.created_at + interval '6 days'
      and now() < draw.created_at + interval '7 days'
      and entry.listened_by is not null
      and nullif(btrim(entry.album_title), '') is not null
      and nullif(btrim(entry.album_artist), '') is not null
      and not exists (
        select 1
        from public.member_album_reviews as review
        where review.album_id = entry.id::text
      )
    on conflict do nothing
    returning entry_id, recipient_id
  )
  insert into public.member_notifications (
    recipient_id, kind, title, body, href
  )
  select
    claimed.recipient_id,
    'task',
    'Dernier jour · avis à rendre',
    'Il reste moins de 24 heures au compteur du tirage pour donner ton avis sur « ' ||
      entry.album_title || ' » de ' || entry.album_artist || '.',
    '/tableur?review=' || entry.id::text
  from claimed
  join public.club_draw_entries as entry on entry.id = claimed.entry_id;

  get diagnostics review_count = row_count;
  return proposal_count + review_count;
end;
$$;

revoke all on function private.send_draw_deadline_reminders() from public, anon, authenticated;

select cron.schedule(
  'draw-deadline-reminders',
  '*/15 * * * *',
  'select private.send_draw_deadline_reminders();'
);

update public.site_updates
set display_order = case id
  when 'bonus-catalog-manual-deezer' then 1
  when 'wheely-reset-theme-refinements' then 2
  else display_order
end
where id in ('bonus-catalog-manual-deezer', 'wheely-reset-theme-refinements');

insert into public.site_updates (id, published_on, display_order, content)
values (
  'draw-deadline-timer-reminders',
  date '2026-07-26',
  0,
  $$ {"version":"2.1","title":"Un chrono de sept jours pour chaque tirage","summary":"Le tirage en cours affiche maintenant son temps restant en heure de Paris et rappelle automatiquement les actions encore manquantes.","categories":["Nouvelle fonctionnalité","Amélioration","Tirages"],"added":[{"text":"Un compte à rebours en temps réel démarre à la création du tirage et mesure exactement sept jours."},{"text":"À mi-parcours, chaque proposeur sans album reçoit un rappel dans la cloche du site."},{"text":"Lorsqu’il reste moins de 24 heures, chaque auditeur sans avis reçoit un dernier rappel."}],"fixed":[],"improved":[{"text":"L’échéance est affichée en heure de Paris sur ordinateur, tablette et mobile."},{"text":"À la fin des sept jours, le compteur reste à zéro sans bloquer le site ; le prochain tirage publié affiche automatiquement son propre chrono."}],"links":[{"label":"Voir le tirage en cours","href":"/tableur"}] } $$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content;
