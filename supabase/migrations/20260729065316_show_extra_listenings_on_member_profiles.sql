update public.site_updates
set content = jsonb_set(
      content,
      '{categories}',
      coalesce(content -> 'categories', '[]'::jsonb)
        || jsonb_build_array('Profil'),
      true
    ),
    updated_at = now()
where id = 'extra-listening-requests'
  and not exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(content -> 'categories', '[]'::jsonb)
    ) as category(value)
    where category.value = 'Profil'
  );

update public.site_updates
set content = jsonb_set(
      content,
      '{improved}',
      coalesce(content -> 'improved', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'text',
            'Les profils réunissent maintenant les albums des tirages et les écoutes supplémentaires dans les listes « écouté » et « proposé », avec une origine clairement indiquée sur chaque carte.'
          )
        ),
      true
    ),
    updated_at = now()
where id = 'extra-listening-requests'
  and not exists (
    select 1
    from jsonb_array_elements(
      coalesce(content -> 'improved', '[]'::jsonb)
    ) as item
    where item ->> 'text' = 'Les profils réunissent maintenant les albums des tirages et les écoutes supplémentaires dans les listes « écouté » et « proposé », avec une origine clairement indiquée sur chaque carte.'
  );
