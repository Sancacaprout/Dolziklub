begin;

create or replace function public.profile_custom_theme_schema_v2()
returns json
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  schema_document jsonb := public.profile_custom_theme_schema_v1()::jsonb;
begin
  schema_document := pg_catalog.jsonb_set(schema_document, '{properties,schemaVersion}', '{"const":2}'::jsonb, false);
  schema_document := pg_catalog.jsonb_set(schema_document, '{required}', (schema_document #> '{required}') || '"sections"'::jsonb, false);
  schema_document := pg_catalog.jsonb_set(schema_document, '{$defs,sectionBox}', $json$
    {"type":"object","additionalProperties":false,"required":["background","border","radius","shadow","padding"],"properties":{"background":{"$ref":"#/$defs/color"},"border":{"$ref":"#/$defs/border"},"radius":{"type":"integer","minimum":0,"maximum":48},"shadow":{"$ref":"#/$defs/shadow"},"padding":{"type":"integer","minimum":0,"maximum":48}}}
  $json$::jsonb, true);
  schema_document := pg_catalog.jsonb_set(schema_document, '{$defs,sectionText}', $json$
    {"type":"object","additionalProperties":false,"required":["family","size","weight","color","transform","italic"],"properties":{"family":{"enum":["space-grotesk","dm-mono","system-sans","system-serif","editorial-serif","humanist-sans","condensed-sans","rounded-sans","typewriter","poster"]},"size":{"type":"number","minimum":10,"maximum":96},"weight":{"enum":[400,500,600,700,800]},"color":{"$ref":"#/$defs/color"},"transform":{"enum":["none","uppercase","lowercase"]},"italic":{"type":"boolean"}}}
  $json$::jsonb, true);
  schema_document := pg_catalog.jsonb_set(schema_document, '{$defs,sectionStyle}', $json$
    {"type":"object","additionalProperties":false,"required":["surface","heading","card","cover","copy","titleText","secondaryText"],"properties":{"surface":{"$ref":"#/$defs/sectionBox"},"heading":{"$ref":"#/$defs/sectionText"},"card":{"$ref":"#/$defs/sectionBox"},"cover":{"$ref":"#/$defs/sectionBox"},"copy":{"$ref":"#/$defs/sectionBox"},"titleText":{"$ref":"#/$defs/sectionText"},"secondaryText":{"$ref":"#/$defs/sectionText"}}}
  $json$::jsonb, true);
  schema_document := pg_catalog.jsonb_set(schema_document, '{properties,sections}', $json$
    {"type":"object","additionalProperties":false,"required":["identity","quiz","favoriteAlbums","favoriteTracks","favoriteArtists","favoriteClip","stats","listened","proposed","bonus"],"properties":{"identity":{"$ref":"#/$defs/sectionStyle"},"quiz":{"$ref":"#/$defs/sectionStyle"},"favoriteAlbums":{"$ref":"#/$defs/sectionStyle"},"favoriteTracks":{"$ref":"#/$defs/sectionStyle"},"favoriteArtists":{"$ref":"#/$defs/sectionStyle"},"favoriteClip":{"$ref":"#/$defs/sectionStyle"},"stats":{"$ref":"#/$defs/sectionStyle"},"listened":{"$ref":"#/$defs/sectionStyle"},"proposed":{"$ref":"#/$defs/sectionStyle"},"bonus":{"$ref":"#/$defs/sectionStyle"}}}
  $json$::jsonb, true);
  return schema_document::json;
end;
$$;

create or replace function public.profile_custom_theme_config_is_valid(p_config jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_config -> 'schemaVersion' = '1'::jsonb then extensions.jsonb_matches_schema(public.profile_custom_theme_schema_v1(), p_config)
    when p_config -> 'schemaVersion' = '2'::jsonb then extensions.jsonb_matches_schema(public.profile_custom_theme_schema_v2(), p_config)
    else false
  end;
$$;

alter table public.profile_custom_theme_drafts
  drop constraint profile_custom_theme_drafts_schema_version_check,
  drop constraint profile_custom_theme_drafts_config_check,
  add constraint profile_custom_theme_drafts_schema_version_check check (schema_version in (1, 2) and schema_version = (config ->> 'schemaVersion')::smallint),
  add constraint profile_custom_theme_drafts_config_check check (public.profile_custom_theme_config_is_valid(config));

alter table public.profile_custom_theme_publications
  drop constraint profile_custom_theme_publications_schema_version_check,
  drop constraint profile_custom_theme_publications_config_check,
  add constraint profile_custom_theme_publications_schema_version_check check (schema_version in (1, 2) and schema_version = (config ->> 'schemaVersion')::smallint),
  add constraint profile_custom_theme_publications_config_check check (public.profile_custom_theme_config_is_valid(config));

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
  config_version smallint;
  saved_at timestamptz := pg_catalog.now();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'revision_invalid' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));
  if p_config is null or not public.profile_custom_theme_config_is_valid(p_config) or pg_catalog.octet_length(p_config::text) > 65536 then
    raise exception 'config_invalid' using errcode = '22023';
  end if;
  config_version := (p_config ->> 'schemaVersion')::smallint;
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
    next_revision := pg_catalog.coalesce(published_revision, 0) + 1;
    insert into public.profile_custom_theme_drafts (
      participant_id, config, schema_version, revision, inspiration_source_theme_id,
      tutorial_completed_at, created_at, updated_at
    ) values (
      caller_id, p_config, config_version, next_revision, p_config ->> 'inspirationSourceThemeId',
      case when p_tutorial_completed then saved_at else null end, saved_at, saved_at
    );
  else
    if current_revision <> p_expected_revision then raise exception 'revision_conflict' using errcode = '40001'; end if;
    next_revision := current_revision + 1;
    update public.profile_custom_theme_drafts
    set config = p_config,
        schema_version = config_version,
        revision = next_revision,
        inspiration_source_theme_id = p_config ->> 'inspirationSourceThemeId',
        tutorial_completed_at = case when p_tutorial_completed then pg_catalog.coalesce(tutorial_completed_at, saved_at) else tutorial_completed_at end,
        updated_at = saved_at
    where participant_id = caller_id;
  end if;

  return pg_catalog.jsonb_build_object('revision', next_revision, 'updatedAt', saved_at);
end;
$$;

revoke all on function public.save_my_profile_custom_theme_draft(jsonb, bigint, boolean) from public, anon;
grant execute on function public.save_my_profile_custom_theme_draft(jsonb, bigint, boolean) to authenticated;

do $$
declare
  section_box jsonb := '{"background":"#FFFDF7","border":{"width":1,"style":"solid","color":"#171715"},"radius":0,"shadow":{"kind":"none","x":0,"y":0,"blur":12,"spread":0,"color":"#171715"},"padding":0}'::jsonb;
  section_text jsonb := '{"family":"space-grotesk","size":24,"weight":700,"color":"#171715","transform":"none","italic":false}'::jsonb;
  section_style jsonb;
  valid_v2 jsonb;
begin
  section_style := pg_catalog.jsonb_build_object('surface', section_box, 'heading', section_text, 'card', section_box, 'cover', section_box, 'copy', section_box, 'titleText', section_text, 'secondaryText', section_text);
  valid_v2 := pg_catalog.jsonb_set(public.profile_custom_theme_default_v1(), '{schemaVersion}', '2'::jsonb)
    || pg_catalog.jsonb_build_object('sections', pg_catalog.jsonb_build_object(
      'identity', section_style, 'quiz', section_style, 'favoriteAlbums', section_style,
      'favoriteTracks', section_style, 'favoriteArtists', section_style, 'favoriteClip', section_style,
      'stats', section_style, 'listened', section_style, 'proposed', section_style, 'bonus', section_style
    ));
  if not public.profile_custom_theme_config_is_valid(public.profile_custom_theme_default_v1()) then raise exception 'profile_custom_theme_v1_regression'; end if;
  if not public.profile_custom_theme_config_is_valid(valid_v2) then raise exception 'profile_custom_theme_v2_schema_rejected_valid_document'; end if;
  if public.profile_custom_theme_config_is_valid(pg_catalog.jsonb_set(valid_v2, '{sections,identity,surface,radius}', '99'::jsonb)) then raise exception 'profile_custom_theme_v2_schema_accepted_invalid_radius'; end if;
  if public.profile_custom_theme_config_is_valid(pg_catalog.jsonb_set(valid_v2, '{sections,identity,hidden}', 'true'::jsonb)) then raise exception 'profile_custom_theme_v2_schema_accepted_unknown_key'; end if;
end;
$$;

commit;
