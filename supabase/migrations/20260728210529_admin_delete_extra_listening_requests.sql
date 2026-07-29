create or replace function public.admin_delete_extra_listening_request(
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_id uuid;
begin
  if (select auth.uid()) is null or not (select private.is_member_admin()) then
    raise exception 'Action réservée aux administrateurs.';
  end if;

  select request.id
  into deleted_id
  from public.extra_listening_requests as request
  where request.id = p_request_id
  for update;

  if deleted_id is null then
    raise exception 'Cette écoute supplémentaire est introuvable.';
  end if;

  delete from public.extra_listening_requests
  where id = deleted_id;

  return deleted_id;
end;
$$;

revoke all on function public.admin_delete_extra_listening_request(uuid)
  from public, anon;
grant execute on function public.admin_delete_extra_listening_request(uuid)
  to authenticated;

update public.site_updates
set content = jsonb_set(
      content,
      '{fixed}',
      coalesce(content -> 'fixed', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'text',
            'Les administrateurs peuvent désormais supprimer définitivement une écoute supplémentaire ajoutée par erreur.'
          )
        ),
      true
    ),
    updated_at = now()
where id = 'extra-listening-requests'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(content -> 'fixed', '[]'::jsonb)) as item
    where item ->> 'text' = 'Les administrateurs peuvent désormais supprimer définitivement une écoute supplémentaire ajoutée par erreur.'
  );

update public.site_updates
set content = jsonb_set(
      content,
      '{improved}',
      coalesce(content -> 'improved', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'text',
            'Le sous-tableau réunit maintenant l’album et l’artiste, masque le statut et rend l’album, la best track, la worst track et l’avis complet directement accessibles.'
          )
        ),
      true
    ),
    updated_at = now()
where id = 'extra-listening-requests'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(content -> 'improved', '[]'::jsonb)) as item
    where item ->> 'text' = 'Le sous-tableau réunit maintenant l’album et l’artiste, masque le statut et rend l’album, la best track, la worst track et l’avis complet directement accessibles.'
  );
