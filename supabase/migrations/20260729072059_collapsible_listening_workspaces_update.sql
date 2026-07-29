do $$
begin
  if not exists (
    select 1
    from public.site_updates
    where id = 'collapsible-listening-workspaces'
  ) then
    update public.site_updates
    set display_order = display_order + 1;
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'collapsible-listening-workspaces',
  date '2026-07-29',
  0,
  $update$
  {
    "version": "2.8",
    "title": "Les espaces d’écoute savent maintenant se faire petits",
    "summary": "Les formulaires d’avis bonus et d’écoute supplémentaire peuvent être réduits à leur titre pour libérer rapidement de la place dans la sélection.",
    "categories": ["Amélioration", "Albums", "Tirages", "Écoutes bonus"],
    "added": [],
    "fixed": [],
    "improved": [
      {"text": "Le bouton « Réduire » masque l’album, les formulaires et les listes tout en conservant les saisies en cours."},
      {"text": "Le bandeau compact garde le titre visible et propose immédiatement l’action « Déplier », sur ordinateur comme sur mobile."}
    ],
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
