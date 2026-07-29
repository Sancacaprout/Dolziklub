do $$
begin
  if not exists (
    select 1 from public.site_updates where id = 'tribunal-one-joker'
  ) then
    update public.site_updates set display_order = display_order + 1;
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'tribunal-one-joker',
  date '2026-07-29',
  0,
  $update$
  {
    "version": "2.13",
    "title": "Un joker entre au Tribunal",
    "summary": "Chaque membre peut désormais passer une seule question par édition grâce à un joker personnel.",
    "categories": ["Nouvelle fonctionnalité", "Amélioration"],
    "added": [
      {"text": "Le bouton « Utiliser mon joker » permet de classer une question sans y répondre."},
      {"text": "Chaque membre ne dispose que d’un seul joker par édition, garanti même en cas de double clic ou de plusieurs onglets."}
    ],
    "fixed": [],
    "improved": [
      {"text": "La question passée compte dans la progression mais le joker est exclu des votes, pourcentages et classements."}
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
