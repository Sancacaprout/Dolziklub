do $$
begin
  if not exists (
    select 1 from public.site_updates where id = 'tribunal-validation-stamp-duration'
  ) then
    update public.site_updates set display_order = display_order + 1;
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'tribunal-validation-stamp-duration',
  date '2026-07-29',
  0,
  $update$
  {
    "version": "2.12",
    "title": "Le verdict du Tribunal reste un peu plus longtemps",
    "summary": "Le tampon affiché après chaque réponse reste désormais assez longtemps à l’écran pour que son message soit parfaitement lisible.",
    "categories": ["Amélioration"],
    "added": [],
    "fixed": [],
    "improved": [
      {"text": "Le message de validation reste visible pendant 1,2 seconde avant l’arrivée de la question suivante."},
      {"text": "L’apparition du tampon est légèrement plus douce, tout en respectant la préférence de réduction des animations."}
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
