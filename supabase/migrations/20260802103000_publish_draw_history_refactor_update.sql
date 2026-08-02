do $$
begin
  if not exists (
    select 1
    from public.site_updates
    where id = 'complete-draw-history-and-global-verdicts'
  ) then
    update public.site_updates
    set display_order = display_order + 1
    where published_on = date '2026-08-02';
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'complete-draw-history-and-global-verdicts',
  date '2026-08-02',
  0,
  $update$
  {
    "version": "2.17",
    "title": "L'historique complet reprend les commandes",
    "summary": "Les tirages 1 \u00e0 8 sont maintenant consolid\u00e9s dans une source durable : les badges, les futurs duos et les verdicts globaux s'appuient enfin sur tout l'historique du club.",
    "categories": ["Am\u00e9lioration", "Correction", "Tirages", "Albums", "Statistiques", "Administration"],
    "added": [
      {"text": "Les 45 albums historiques des tirages 1 \u00e0 5 rejoignent les tirages 6 \u00e0 8 dans la base, avec leurs propositions, auditeurs, notes, avis et morceaux disponibles."},
      {"text": "La pr\u00e9paration d'un tirage classique recherche des relations orient\u00e9es in\u00e9dites : Thomas vers Enzo reste distinct de Enzo vers Thomas."},
      {"text": "Les albums globaux disposent d'une page unique qui conserve un verdict ind\u00e9pendant pour chaque membre participant."}
    ],
    "fixed": [
      {"text": "Les compteurs et les 29 badges sont recalcul\u00e9s pour tous les membres \u00e0 partir des tirages persistants, des \u00e9coutes bonus et des \u00e9coutes suppl\u00e9mentaires."},
      {"text": "Les avis bonus publics sont de nouveau accessibles sans exposer les donn\u00e9es priv\u00e9es des membres."}
    ],
    "improved": [
      {"text": "Les listes de tirages affichent les num\u00e9ros les plus r\u00e9cents en premier, sans modifier l'ordre interne des albums."},
      {"text": "Quand aucun tirage enti\u00e8rement nouveau n'existe, le site minimise les r\u00e9p\u00e9titions, privil\u00e9gie les plus anciennes et avertit clairement l'administration."}
    ],
    "links": [
      {"label": "Voir les tirages", "href": "/tableur"},
      {"label": "Explorer les albums", "href": "/albums"}
    ]
  }
  $update$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content,
    updated_at = now();
