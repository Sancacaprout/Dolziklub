begin;

create or replace function public.reset_my_profile_custom_theme_draft(p_expected_revision bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  current_draft public.profile_custom_theme_drafts%rowtype;
  current_publication public.profile_custom_theme_publications%rowtype;
  reset_at timestamptz := pg_catalog.now();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'revision_invalid' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));

  select * into current_draft
  from public.profile_custom_theme_drafts
  where participant_id = caller_id
  for update;
  if found and current_draft.revision <> p_expected_revision then raise exception 'revision_conflict' using errcode = '40001'; end if;
  if not found and p_expected_revision <> 0 then raise exception 'revision_conflict' using errcode = '40001'; end if;

  select * into current_publication
  from public.profile_custom_theme_publications
  where participant_id = caller_id;

  if current_publication.participant_id is null then
    delete from public.profile_custom_theme_drafts where participant_id = caller_id;
  else
    insert into public.profile_custom_theme_drafts (
      participant_id, config, schema_version, revision, inspiration_source_theme_id,
      tutorial_completed_at, created_at, updated_at
    ) values (
      caller_id, current_publication.config, current_publication.schema_version, current_publication.revision,
      current_publication.config ->> 'inspirationSourceThemeId', current_draft.tutorial_completed_at,
      coalesce(current_draft.created_at, reset_at), reset_at
    )
    on conflict (participant_id) do update
    set config = excluded.config,
        schema_version = excluded.schema_version,
        revision = excluded.revision,
        inspiration_source_theme_id = excluded.inspiration_source_theme_id,
        updated_at = excluded.updated_at;
  end if;

  insert into public.profile_audit_log (participant_id, actor_id, event_type, detail)
  values (caller_id, caller_id, 'custom_theme_reset', pg_catalog.jsonb_build_object('previous_revision', p_expected_revision));

  return pg_catalog.jsonb_build_object(
    'config', coalesce(current_publication.config, public.profile_custom_theme_default_v1()),
    'revision', coalesce(current_publication.revision, 0),
    'publishedRevision', current_publication.revision
  );
end;
$$;

create or replace function public.publish_my_profile_custom_theme(expected_revision bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  current_draft public.profile_custom_theme_drafts%rowtype;
  referenced_assets uuid[];
  owned_asset_count integer;
  published_at timestamptz := pg_catalog.now();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if expected_revision is null or expected_revision < 1 then raise exception 'revision_invalid' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));

  select * into current_draft
  from public.profile_custom_theme_drafts
  where participant_id = caller_id
  for update;
  if current_draft.participant_id is null then raise exception 'draft_missing' using errcode = 'P0002'; end if;
  if current_draft.revision <> expected_revision then raise exception 'revision_conflict' using errcode = '40001'; end if;
  if current_draft.schema_version <> (current_draft.config ->> 'schemaVersion')::smallint
     or not public.profile_custom_theme_config_is_valid(current_draft.config) then
    raise exception 'config_invalid' using errcode = '22023';
  end if;

  select coalesce(pg_catalog.array_agg(distinct reference.asset_id), '{}'::uuid[])
  into referenced_assets
  from (
    select nullif(current_draft.config #>> '{backgrounds,image,assetId}', '')::uuid as asset_id
    union all
    select (item ->> 'assetId')::uuid
    from pg_catalog.jsonb_array_elements(current_draft.config -> 'decorations') item
  ) reference
  where reference.asset_id is not null;

  select pg_catalog.count(*) into owned_asset_count
  from public.profile_custom_theme_assets asset
  where asset.participant_id = caller_id and asset.id = any(referenced_assets);
  if owned_asset_count <> pg_catalog.cardinality(referenced_assets) then
    raise exception 'asset_not_owned' using errcode = '42501';
  end if;

  insert into public.profile_custom_theme_publications (
    participant_id, config, schema_version, revision, asset_ids, published_at
  ) values (
    caller_id, current_draft.config, current_draft.schema_version, current_draft.revision, referenced_assets, published_at
  )
  on conflict (participant_id) do update
  set config = excluded.config,
      schema_version = excluded.schema_version,
      revision = excluded.revision,
      asset_ids = excluded.asset_ids,
      published_at = excluded.published_at;

  update public.member_public_profiles
  set profile_theme = 'custom', profile_theme_selected_at = published_at
  where id = caller_id;
  if not found then raise exception 'profile_missing' using errcode = '23503'; end if;

  insert into public.profile_audit_log (participant_id, actor_id, event_type, detail)
  values (caller_id, caller_id, 'custom_theme_published', pg_catalog.jsonb_build_object('revision', current_draft.revision, 'asset_ids', referenced_assets));

  return pg_catalog.jsonb_build_object('revision', current_draft.revision, 'publishedAt', published_at, 'assetIds', referenced_assets);
end;
$$;

revoke all on function public.reset_my_profile_custom_theme_draft(bigint) from public, anon;
grant execute on function public.reset_my_profile_custom_theme_draft(bigint) to authenticated;
revoke all on function public.publish_my_profile_custom_theme(bigint) from public, anon;
grant execute on function public.publish_my_profile_custom_theme(bigint) to authenticated;

do $$
declare
  reset_definition text := pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.reset_my_profile_custom_theme_draft(bigint)'));
  publish_definition text := pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.publish_my_profile_custom_theme(bigint)'));
begin
  if position('current_publication.schema_version' in reset_definition) = 0 then
    raise exception 'custom_theme_reset_does_not_preserve_schema_version';
  end if;
  if position('current_draft.schema_version' in publish_definition) = 0 then
    raise exception 'custom_theme_publish_does_not_preserve_schema_version';
  end if;
  if position('profile_custom_theme_config_is_valid' in publish_definition) = 0 then
    raise exception 'custom_theme_publish_does_not_revalidate_config';
  end if;
end;
$$;

commit;
