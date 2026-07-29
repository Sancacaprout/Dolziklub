do $$
begin
  if not exists (
    select 1
    from public.site_updates
    where id = 'noir-cinema-member-name-contrast'
  ) then
    update public.site_updates
    set display_order = display_order + 1;
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'noir-cinema-member-name-contrast',
  date '2026-07-29',
  0,
  $update$
  {
    "version": "2.9",
    "title": "Les prénoms ressortent dans Noir Cinéma",
    "summary": "Les noms des membres associés aux albums restent maintenant parfaitement lisibles sur les cartes sombres du thème Noir Cinéma.",
    "categories": ["Correction", "Profil", "Albums"],
    "added": [],
    "fixed": [
      {"text": "Les prénoms affichés après « Proposé par » et « Écouté par » utilisent désormais la couleur claire du thème, dans les cartes classiques comme dans les listes."}
    ],
    "improved": [],
    "links": [
      {"label": "Voir les membres", "href": "/membres"}
    ]
  }
  $update$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content,
    updated_at = now();
