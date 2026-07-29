create or replace function private.enforce_extra_listening_current_draw()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_draw_number integer;
begin
  select draw_number
  into current_draw_number
  from public.club_draws
  where status = 'published'
  order by draw_number desc
  limit 1;

  if current_draw_number is null or new.draw_number <> current_draw_number then
    raise exception 'Les écoutes supplémentaires concernent uniquement le tirage actuel.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_extra_listening_current_draw() from public, anon, authenticated;

drop trigger if exists extra_listening_requests_current_draw_only
  on public.extra_listening_requests;
create trigger extra_listening_requests_current_draw_only
  before insert on public.extra_listening_requests
  for each row execute function private.enforce_extra_listening_current_draw();

update public.site_updates
set content = jsonb_set(
      content,
      '{improved}',
      coalesce(content -> 'improved', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'text',
            'Les demandes d’écoute supplémentaire sont désormais limitées au seul tirage actuel.'
          )
        ),
      true
    ),
    updated_at = now()
where id = 'extra-listening-requests'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(content -> 'improved', '[]'::jsonb)) as item
    where item ->> 'text' = 'Les demandes d’écoute supplémentaire sont désormais limitées au seul tirage actuel.'
  );
