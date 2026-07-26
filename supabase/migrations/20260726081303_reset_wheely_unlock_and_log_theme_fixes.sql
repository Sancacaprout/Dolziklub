-- Wheely starts locked for every member again. Existing victories and equipped
-- profiles are intentionally reset; a new completed run is required to unlock it.
update public.member_public_profiles
set profile_theme = 'dol-ziklub',
    profile_theme_selected_at = now()
where profile_theme = 'wheely';

delete from public.participant_achievements
where achievement_key = 'wheely-theme';

-- Keep the database trigger as the final authority: administrators are subject
-- to the same achievement requirement as every other member.
create or replace function private.enforce_profile_theme_unlock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.profile_theme = 'wheely'
     and (tg_op = 'INSERT' or old.profile_theme is distinct from new.profile_theme)
     and not exists (
       select 1
       from public.participant_achievements achievement
       where achievement.participant_id = new.id
         and achievement.achievement_key = 'wheely-theme'
     ) then
    raise exception 'Termine le mini-jeu Wheely avant d''equiper ce theme.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_profile_theme_unlock() from public, anon, authenticated;

-- The fallback source is kept in sync with this persistent public entry.
insert into public.site_updates (id, published_on, display_order, content)
values (
  'wheely-reset-theme-refinements',
  date '2026-07-26',
  0,
  $$ {"version":"1.9","title":"Wheely repart de z\u00e9ro, les nouveaux profils s\u2019affinent","summary":"Le d\u00e9blocage Wheely est r\u00e9initialis\u00e9 pour tout le club et les quatre nouveaux univers de profil gagnent en pr\u00e9cision visuelle.","categories":["Correction","Am\u00e9lioration","Profil"],"added":[],"fixed":[{"text":"Le th\u00e8me Wheely est \u00e0 nouveau verrouill\u00e9 pour tous les membres, y compris les anciens gagnants. Il se d\u00e9bloque uniquement apr\u00e8s avoir termin\u00e9 le mini-jeu."},{"text":"Les images de Noir Cin\u00e9ma et la photo de profil de Manga Panel conservent d\u00e9sormais leurs couleurs d\u2019origine."},{"text":"Les boutons \u00ab Voir le profil \u00bb de Punk Poster, Jazz Lounge et Acid Rave retrouvent la m\u00eame taille que les autres th\u00e8mes."},{"text":"Les cadres du profil et des notes sont d\u00e9sormais ferm\u00e9s dans Museum White."}],"improved":[{"text":"Le d\u00e9grad\u00e9 de Cassette Sunset passe plus naturellement du ciel violet \u00e0 l\u2019horizon chaud."},{"text":"Les contours sobres de Museum White restent lisibles sur ordinateur comme sur mobile."}],"links":[{"label":"Choisir un th\u00e8me","href":"/compte"},{"label":"Lancer Wheely","href":"/"},{"label":"Voir les profils","href":"/membres"}] } $$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content;
