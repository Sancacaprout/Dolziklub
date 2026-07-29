begin;

-- These helpers only read rows already available to the caller through RLS.
-- SECURITY INVOKER removes an unnecessary privilege boundary and keeps them
-- from being exposed as privileged public RPCs.
create or replace function public.profile_custom_theme_asset_is_published(p_asset_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_custom_theme_publications publication
    where p_asset_id = any(publication.asset_ids)
  );
$$;

create or replace function public.profile_custom_theme_asset_is_referenced(p_asset_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_custom_theme_publications publication
    where publication.participant_id = (select auth.uid()) and p_asset_id = any(publication.asset_ids)
  ) or exists (
    select 1
    from public.profile_custom_theme_drafts draft
    where draft.participant_id = (select auth.uid())
      and (
        draft.config #>> '{backgrounds,image,assetId}' = p_asset_id::text
        or exists (
          select 1 from jsonb_array_elements(draft.config -> 'decorations') item
          where item ->> 'assetId' = p_asset_id::text
        )
      )
  );
$$;

revoke all on function public.profile_custom_theme_asset_is_published(uuid) from public;
grant execute on function public.profile_custom_theme_asset_is_published(uuid) to anon, authenticated;
revoke all on function public.profile_custom_theme_asset_is_referenced(uuid) from public, anon;
grant execute on function public.profile_custom_theme_asset_is_referenced(uuid) to authenticated;

drop policy if exists "Published custom theme assets are publicly readable" on public.profile_custom_theme_assets;
drop policy if exists "profile theme asset owners can read metadata" on public.profile_custom_theme_assets;
create policy "Members and visitors read allowed custom theme assets"
on public.profile_custom_theme_assets for select to anon, authenticated
using (
  participant_id = (select auth.uid())
  or public.profile_custom_theme_asset_is_published(id)
);

drop policy if exists "Published custom theme objects are publicly readable" on storage.objects;
drop policy if exists "profile theme asset owners can read objects" on storage.objects;
create policy "Members and visitors read allowed custom theme objects"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'profile-theme-assets'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.profile_custom_theme_assets asset
      where asset.storage_path = name
        and public.profile_custom_theme_asset_is_published(asset.id)
    )
  )
);

commit;
