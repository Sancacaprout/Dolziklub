do $$
begin
  if not exists (
    select 1 from public.site_updates where id = 'le-tribunal'
  ) then
    update public.site_updates set display_order = display_order + 1;
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'le-tribunal',
  date '2026-07-29',
  0,
  $update$
  {
    "version": "2.11",
    "title": "Le Tribunal ouvre les dossiers du club",
    "summary": "Le Tribunal est ouvert : réponds à 16 questions anonymes sur les goûts, les notes et les propositions du club, puis découvre les résultats à la fin de l’édition.",
    "categories": ["Nouvelle fonctionnalité", "Amélioration", "Albums", "Administration"],
    "added": [
      {"text": "Une édition collective enregistre une réponse par membre et par question, avec reprise automatique là où chacun s’est arrêté."},
      {"text": "Les questions utilisent les vrais membres, albums proposés, notes et avis du tableur."},
      {"text": "Après clôture et révélation, les résultats montrent les votes, pourcentages, podiums et réponses libres sans afficher leurs auteurs."}
    ],
    "fixed": [],
    "improved": [
      {"text": "L’administration peut créer, ouvrir, fermer et révéler une édition, désactiver une question et masquer une réponse libre sans la supprimer."}
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
