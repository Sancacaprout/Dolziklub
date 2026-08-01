begin;

update public.site_updates
set display_order = greatest(display_order, 1)
where published_on = date '2026-08-01'
  and id <> 'custom-profile-theme-editor';

insert into public.site_updates (id, published_on, display_order, content)
values (
  'custom-profile-theme-editor',
  date '2026-08-01',
  0,
  $update$
  {
    "version": "2.15",
    "title": "Ton profil devient un atelier de cr\u00e9ation",
    "summary": "Cr\u00e9e d\u00e9sormais ton propre th\u00e8me de profil, pr\u00e9visualise-le sur tes vraies donn\u00e9es, puis publie-le sans changer la structure du site.",
    "categories": ["Nouvelle fonctionnalit\u00e9", "Am\u00e9lioration", "Profil"],
    "added": [
      {"text": "Un \u00e9diteur complet permet de personnaliser couleurs, typographies, fonds, cadres, cartes, mouvements et images d\u00e9coratives dans des limites s\u00fbres."},
      {"text": "Le brouillon reste priv\u00e9, se recharge apr\u00e8s navigation et peut \u00eatre publi\u00e9 puis activ\u00e9 directement sur le profil public."}
    ],
    "fixed": [
      {"text": "La publication et la r\u00e9initialisation conservent maintenant la bonne version du th\u00e8me : les r\u00e9glages r\u00e9cents ne restent plus bloqu\u00e9s sur un ancien \u00e9tat."}
    ],
    "improved": [
      {"text": "La carte PERSONNALIS\u00c9 devient un v\u00e9ritable atelier visuel avec grille, calques, r\u00e8gle, crayon et action OUVRIR L\u2019\u00c9DITEUR clairement identifiable."},
      {"text": "La structure, l\u2019ordre des sections et les actions du profil restent enti\u00e8rement pilot\u00e9s par le site, sur ordinateur comme sur mobile."}
    ],
    "links": [
      {"label": "Cr\u00e9er mon th\u00e8me", "href": "/compte/theme-personnalise"}
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
    select 1 from public.site_updates
    where id = 'custom-profile-theme-editor'
      and published_on = date '2026-08-01'
      and display_order = 0
      and content ->> 'version' = '2.15'
  ) then
    raise exception 'custom_profile_theme_editor_update_not_published';
  end if;
end;
$$;

commit;
