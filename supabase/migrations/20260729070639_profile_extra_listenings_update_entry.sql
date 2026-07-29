update public.site_updates
set content = jsonb_set(
      jsonb_set(
        content,
        '{categories}',
        coalesce(
          (
            select jsonb_agg(to_jsonb(category.value))
            from jsonb_array_elements_text(
              coalesce(content -> 'categories', '[]'::jsonb)
            ) as category(value)
            where category.value <> 'Profil'
          ),
          '[]'::jsonb
        ),
        true
      ),
      '{improved}',
      coalesce(
        (
          select jsonb_agg(item)
          from jsonb_array_elements(
            coalesce(content -> 'improved', '[]'::jsonb)
          ) as item
          where item ->> 'text' <> 'Les profils réunissent maintenant les albums des tirages et les écoutes supplémentaires dans les listes « écouté » et « proposé », avec une origine clairement indiquée sur chaque carte.'
        ),
        '[]'::jsonb
      ),
      true
    ),
    updated_at = now()
where id = 'extra-listening-requests';

do $$
begin
  if not exists (
    select 1 from public.site_updates
    where id = 'extra-listenings-on-member-profiles'
  ) then
    update public.site_updates
    set display_order = display_order + 1;
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'extra-listenings-on-member-profiles',
  date '2026-07-29',
  0,
  $update$
  {
    "version": "2.7",
    "title": "Les écoutes supplémentaires rejoignent les profils",
    "summary": "Les albums supplémentaires apparaissent maintenant dans les propositions et les écoutes des membres, sans être confondus avec les albums des tirages classiques.",
    "categories": ["Amélioration", "Profil", "Albums", "Tirages"],
    "added": [],
    "fixed": [],
    "improved": [
      {"text": "Une proposition supplémentaire rejoint la liste « a proposé » du membre qui a choisi l’album."},
      {"text": "Une écoute supplémentaire terminée rejoint la liste « a écouté » du membre qui a rendu son verdict."},
      {"text": "Chaque carte indique clairement « Écoute supplémentaire · Tirage XX » ou « Tirage classique · Tirage XX »."}
    ],
    "links": [
      {"label": "Voir les membres", "href": "/membres"},
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
