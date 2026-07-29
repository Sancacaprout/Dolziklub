begin;

create or replace function public.save_my_profile_custom_theme_draft(
  p_config jsonb,
  p_expected_revision bigint,
  p_tutorial_completed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  current_revision bigint;
  published_revision bigint;
  next_revision bigint;
  saved_at timestamptz := pg_catalog.now();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'revision_invalid' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));
  if p_config is null
     or not extensions.jsonb_matches_schema(public.profile_custom_theme_schema_v1(), p_config)
     or octet_length(p_config::text) > 65536 then
    raise exception 'config_invalid' using errcode = '22023';
  end if;
  if not exists (select 1 from public.member_public_profiles profile where profile.id = caller_id) then
    raise exception 'profile_missing' using errcode = '23503';
  end if;

  select draft.revision into current_revision
  from public.profile_custom_theme_drafts draft
  where draft.participant_id = caller_id
  for update;

  if current_revision is null then
    if p_expected_revision <> 0 then raise exception 'revision_conflict' using errcode = '40001'; end if;
    select publication.revision into published_revision
    from public.profile_custom_theme_publications publication
    where publication.participant_id = caller_id;
    next_revision := coalesce(published_revision, 0) + 1;
    insert into public.profile_custom_theme_drafts (
      participant_id, config, schema_version, revision, inspiration_source_theme_id,
      tutorial_completed_at, created_at, updated_at
    ) values (
      caller_id, p_config, 1, next_revision, p_config ->> 'inspirationSourceThemeId',
      case when p_tutorial_completed then saved_at else null end, saved_at, saved_at
    );
  else
    if current_revision <> p_expected_revision then raise exception 'revision_conflict' using errcode = '40001'; end if;
    next_revision := current_revision + 1;
    update public.profile_custom_theme_drafts
    set config = p_config,
        schema_version = 1,
        revision = next_revision,
        inspiration_source_theme_id = p_config ->> 'inspirationSourceThemeId',
        tutorial_completed_at = case when p_tutorial_completed then coalesce(tutorial_completed_at, saved_at) else tutorial_completed_at end,
        updated_at = saved_at
    where participant_id = caller_id;
  end if;

  return jsonb_build_object('revision', next_revision, 'updatedAt', saved_at);
end;
$$;

revoke all on function public.save_my_profile_custom_theme_draft(jsonb, bigint, boolean) from public, anon;
grant execute on function public.save_my_profile_custom_theme_draft(jsonb, bigint, boolean) to authenticated;

commit;
