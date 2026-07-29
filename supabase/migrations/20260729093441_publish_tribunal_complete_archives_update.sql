do $$
begin
  if not exists (
    select 1
    from public.site_updates
    where id = 'tribunal-complete-archives-and-covers'
  ) then
    update public.site_updates
    set display_order = display_order + 1;
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'tribunal-complete-archives-and-covers',
  date '2026-07-29',
  0,
  $update$
  {
    "version": "2.14",
    "title": "Toutes les archives entrent au Tribunal",
    "summary": "Les choix d’albums et d’avis du Tribunal couvrent désormais tous les tirages, avec leurs jaquettes.",
    "categories": ["Correction", "Amélioration"],
    "added": [],
    "fixed": [
      {"text": "Les questions sur les albums et les notes ne sont plus limitées aux tirages récents : les tirages 01 à 08 sont réunis dans la même recherche."},
      {"text": "Les jaquettes historiques et les pochettes des avis s’affichent maintenant dans les cartes de sélection."}
    ],
    "improved": [
      {"text": "Les archives et les tirages Supabase sont dédupliqués, tout en conservant un identifiant stable pour enregistrer et retrouver chaque réponse."},
      {"text": "La recherche des avis reconnaît aussi le contenu de l’avis, en plus de l’album, de l’artiste et du membre."}
    ],
    "links": [
      {"label": "Entrer au Tribunal", "href": "/tribunal"}
    ]
  }
  $update$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content,
    updated_at = now();