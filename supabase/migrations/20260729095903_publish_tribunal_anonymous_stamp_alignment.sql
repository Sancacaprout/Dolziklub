do $$
begin
  if not exists (
    select 1
    from public.site_updates
    where id = 'tribunal-anonymous-stamp-alignment'
  ) then
    update public.site_updates
    set display_order = display_order + 1;
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'tribunal-anonymous-stamp-alignment',
  date '2026-07-29',
  0,
  $update$
  {
    "version": "2.15",
    "title": "Le tampon anonyme est recadré",
    "summary": "Le mot « ANONYME » reste maintenant centré et correctement espacé dans son cadre rouge sur la page du Tribunal.",
    "categories": ["Correction visuelle"],
    "added": [],
    "fixed": [
      {"text": "Le libellé « ANONYME » ne touche plus le bord droit de son tampon et conserve un cadrage équilibré."}
    ],
    "improved": [
      {"text": "La taille et l’espace intérieur du tampon s’adaptent désormais aux largeurs bureau et mobile."}
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