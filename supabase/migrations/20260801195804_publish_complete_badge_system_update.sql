begin;

update public.site_updates
set display_order = display_order + 1
where published_on = date '2026-08-01'
  and id <> 'complete-club-badge-system';

insert into public.site_updates (id, published_on, display_order, content)
values (
  'complete-club-badge-system',
  date '2026-08-01',
  0,
  $update$
  {
    "version": "2.16",
    "title": "29 badges rejoignent le DOL ZIKLUB",
    "summary": "Tes propositions, tes \u00e9coutes, le Tribunal et Wheely peuvent maintenant d\u00e9bloquer une collection compl\u00e8te de badges.",
    "categories": ["Nouvelle fonctionnalit\u00e9", "Profils", "Club"],
    "added": [
      {"text": "29 badges permanents r\u00e9compensent les grandes \u00e9tapes du club, avec des objectifs cumulatifs, temporels et secrets."},
      {"text": "Les accomplissements d\u00e9j\u00e0 r\u00e9alis\u00e9s ont \u00e9t\u00e9 recalcul\u00e9s : les badges r\u00e9troactifs attendent simplement d\u2019\u00eatre r\u00e9clam\u00e9s."},
      {"text": "Chaque membre poss\u00e8de une collection priv\u00e9e et peut afficher jusqu\u2019\u00e0 trois badges pr\u00e8s de son avatar public."}
    ],
    "fixed": [],
    "improved": [
      {"text": "Un d\u00e9blocage d\u00e9clenche une notification et une animation de r\u00e9v\u00e9lation, puis reste disponible dans Mon compte."},
      {"text": "Les cadres de badges s\u2019adaptent au th\u00e8me du profil sans recolorer ni d\u00e9former leurs illustrations."}
    ],
    "links": [
      {"label": "Voir ma collection", "href": "/compte"},
      {"label": "Voir les membres", "href": "/membres"}
    ]
  }
  $update$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content,
    updated_at = pg_catalog.now();

do $$
begin
  if not exists (
    select 1
    from public.site_updates
    where id = 'complete-club-badge-system'
      and published_on = date '2026-08-01'
      and display_order = 0
      and content ->> 'version' = '2.16'
  ) then
    raise exception 'complete_club_badge_system_update_not_published';
  end if;
end;
$$;

commit;
