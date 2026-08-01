-- A participant may read anonymous aggregate results as soon as every active
-- question has one of their responses (a joker counts as a completed answer).
do $migration$
declare
  function_definition text;
  previous_guard constant text := $guard$
  if selected_session.status <> 'results_revealed' and not caller_is_admin then
    raise exception 'Les résultats ne sont pas encore révélés';
  end if;
$guard$;
  completed_guard constant text := $guard$
  if selected_session.status <> 'results_revealed'
     and not caller_is_admin
     and not exists (
       select 1
       from public.tribunal_session_participants participant
       where participant.session_id = selected_session.id
         and participant.participant_id = caller_id
         and exists (
           select 1
           from public.tribunal_questions active_question
           where active_question.session_id = selected_session.id
             and active_question.is_active
         )
         and not exists (
           select 1
           from public.tribunal_questions active_question
           where active_question.session_id = selected_session.id
             and active_question.is_active
             and not exists (
               select 1
               from public.tribunal_responses own_response
               where own_response.session_id = selected_session.id
                 and own_response.question_id = active_question.id
                 and own_response.respondent_participant_id = caller_id
             )
         )
     ) then
    raise exception 'Termine toutes les questions avant de consulter les résultats';
  end if;
$guard$;
begin
  select pg_get_functiondef(
    'public.get_tribunal_results(bigint)'::regprocedure
  ) into function_definition;

  if position(previous_guard in function_definition) = 0 then
    raise exception 'Le garde d’accès attendu aux résultats du Tribunal est introuvable';
  end if;

  execute replace(function_definition, previous_guard, completed_guard);
end;
$migration$;

revoke all on function public.get_tribunal_results(bigint)
  from public, anon, authenticated;
grant execute on function public.get_tribunal_results(bigint)
  to authenticated;

-- Small visual fixes are folded into this substantial release instead of
-- receiving a standalone public version.
delete from public.site_updates
where id in (
  'noir-cinema-member-name-contrast',
  'tribunal-validation-stamp-duration'
);

do $$
begin
  if not exists (
    select 1 from public.site_updates
    where id = 'tribunal-results-after-completion'
  ) then
    update public.site_updates set display_order = display_order + 1;
  end if;
end;
$$;

insert into public.site_updates (id, published_on, display_order, content)
values (
  'tribunal-results-after-completion',
  date '2026-08-01',
  0,
  $update$
  {
    "version": "2.14",
    "title": "Le Tribunal rend son verdict dès la dernière réponse",
    "summary": "Termine ton questionnaire et les résultats anonymes de tous les participants se dévoilent immédiatement dans une nouvelle séquence animée.",
    "categories": ["Nouvelle fonctionnalité", "Amélioration", "Administration", "Profil"],
    "added": [
      {"text": "Chaque membre ayant répondu à toutes les questions actives accède immédiatement aux résultats, sans attendre la clôture administrative de l’édition."},
      {"text": "Une séquence de déclassification animée accompagne la fin du questionnaire et l’arrivée progressive des résultats."}
    ],
    "fixed": [
      {"text": "Les prénoms restent lisibles sur les cartes sombres du thème Noir Cinéma ; cette petite correction est désormais regroupée ici plutôt que publiée seule."}
    ],
    "improved": [
      {"text": "Les administrateurs conservent la gestion des éditions, la prévisualisation et le masquage réversible des réponses libres."},
      {"text": "Le tampon de validation reste lisible avant la révélation finale, sans créer une micro-version séparée."}
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
