do $$
begin
  if not exists (
    select 1
    from public.site_updates
    where id = 'bonus-reviews-responsive-layout'
  ) then
    update public.site_updates
    set display_order = display_order + 1;
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'bonus-reviews-responsive-layout',
  date '2026-07-29',
  0,
  $update$
  {
    "version": "2.10",
    "title": "Les écoutes bonus retrouvent toute leur largeur",
    "summary": "Les avis bonus restent maintenant lisibles dans les cellules étroites du tableur, notamment sur mobile.",
    "categories": ["Correction", "Albums", "Tirages", "Écoutes bonus"],
    "added": [],
    "fixed": [
      {"text": "Le titre de l’avis, son texte et le lien « Lire l’avis complet » s’affichent de nouveau verticalement au lieu d’être comprimés en colonnes."},
      {"text": "Les blocs d’écoutes bonus peuvent désormais rétrécir jusqu’à la largeur disponible sans provoquer de débordement sur mobile."}
    ],
    "improved": [],
    "links": [
      {"label": "Ouvrir le tableur", "href": "/tableur"}
    ]
  }
  $update$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content,
    updated_at = now();
