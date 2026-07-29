begin;

create extension if not exists pg_jsonschema with schema extensions;

create or replace function public.profile_custom_theme_schema_v1()
returns json
language sql
immutable
parallel safe
set search_path = ''
as $$
  select $json$
  {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "additionalProperties": false,
    "required": ["schemaVersion", "inspirationSourceThemeId", "colors", "typography", "backgrounds", "borders", "radii", "shadows", "cards", "headings", "buttons", "avatar", "stats", "podium", "video", "decorations", "motion"],
    "properties": {
      "schemaVersion": { "const": 1 },
      "inspirationSourceThemeId": {
        "oneOf": [
          { "type": "null" },
          { "enum": ["dol-ziklub", "archive", "dark-vinyl", "fanzine", "neon-club", "natural-tape", "chrome-2000", "city-pop", "punk-poster", "jazz-lounge", "acid-rave", "wheely", "noir-cinema", "manga-panel", "cassette-sunset", "museum-white"] }
        ]
      },
      "colors": {
        "type": "object",
        "additionalProperties": false,
        "required": ["page", "surface", "surfaceAlt", "text", "mutedText", "accent", "accentAlt", "title", "border", "link", "buttonBackground", "buttonText", "badgeBackground", "badgeText", "statBackground", "statText", "separator"],
        "properties": {
          "page": { "$ref": "#/$defs/color" }, "surface": { "$ref": "#/$defs/color" }, "surfaceAlt": { "$ref": "#/$defs/color" },
          "text": { "$ref": "#/$defs/color" }, "mutedText": { "$ref": "#/$defs/color" }, "accent": { "$ref": "#/$defs/color" },
          "accentAlt": { "$ref": "#/$defs/color" }, "title": { "$ref": "#/$defs/color" }, "border": { "$ref": "#/$defs/color" },
          "link": { "$ref": "#/$defs/color" }, "buttonBackground": { "$ref": "#/$defs/color" }, "buttonText": { "$ref": "#/$defs/color" },
          "badgeBackground": { "$ref": "#/$defs/color" }, "badgeText": { "$ref": "#/$defs/color" }, "statBackground": { "$ref": "#/$defs/color" },
          "statText": { "$ref": "#/$defs/color" }, "separator": { "$ref": "#/$defs/color" }
        }
      },
      "typography": {
        "type": "object", "additionalProperties": false,
        "required": ["display", "body", "label", "button", "stat"],
        "properties": {
          "display": { "allOf": [{ "$ref": "#/$defs/typography" }, { "properties": { "size": { "type": "number", "minimum": 24, "maximum": 96 } } }] },
          "body": { "allOf": [{ "$ref": "#/$defs/typography" }, { "properties": { "size": { "type": "number", "minimum": 13, "maximum": 24 } } }] },
          "label": { "allOf": [{ "$ref": "#/$defs/typography" }, { "properties": { "size": { "type": "number", "minimum": 10, "maximum": 18 } } }] },
          "button": { "allOf": [{ "$ref": "#/$defs/typography" }, { "properties": { "size": { "type": "number", "minimum": 10, "maximum": 20 } } }] },
          "stat": { "allOf": [{ "$ref": "#/$defs/typography" }, { "properties": { "size": { "type": "number", "minimum": 24, "maximum": 72 } } }] }
        }
      },
      "backgrounds": {
        "type": "object", "additionalProperties": false,
        "required": ["mode", "color", "gradient", "pattern", "image", "overlay"],
        "properties": {
          "mode": { "enum": ["solid", "gradient", "pattern", "image"] },
          "color": { "$ref": "#/$defs/color" },
          "gradient": { "type": "object", "additionalProperties": false, "required": ["from", "to", "angle"], "properties": { "from": { "$ref": "#/$defs/color" }, "to": { "$ref": "#/$defs/color" }, "angle": { "type": "integer", "minimum": 0, "maximum": 360 } } },
          "pattern": { "type": "object", "additionalProperties": false, "required": ["kind", "color", "scale", "opacity", "rotation"], "properties": { "kind": { "enum": ["none", "dots", "grid", "paper", "grain", "vinyl", "lines", "checkerboard", "waves", "screen", "stars", "collage", "halftone"] }, "color": { "$ref": "#/$defs/color" }, "scale": { "type": "integer", "minimum": 8, "maximum": 120 }, "opacity": { "type": "number", "minimum": 0, "maximum": 0.5 }, "rotation": { "type": "integer", "minimum": -45, "maximum": 45 } } },
          "image": { "type": "object", "additionalProperties": false, "required": ["assetId", "opacity", "position", "size", "repeat", "brightness", "contrast", "blur"], "properties": { "assetId": { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/uuid" }] }, "opacity": { "type": "number", "minimum": 0.1, "maximum": 1 }, "position": { "enum": ["center", "top", "bottom", "left", "right"] }, "size": { "enum": ["cover", "contain"] }, "repeat": { "enum": ["no-repeat", "repeat"] }, "brightness": { "type": "number", "minimum": 0.5, "maximum": 1.5 }, "contrast": { "type": "number", "minimum": 0.5, "maximum": 1.5 }, "blur": { "type": "number", "minimum": 0, "maximum": 12 } } },
          "overlay": { "type": "object", "additionalProperties": false, "required": ["color", "opacity"], "properties": { "color": { "$ref": "#/$defs/color" }, "opacity": { "type": "number", "minimum": 0, "maximum": 0.85 } } }
        }
      },
      "borders": { "$ref": "#/$defs/borderTargets" },
      "radii": { "$ref": "#/$defs/radiusTargets" },
      "shadows": { "$ref": "#/$defs/shadowTargets" },
      "cards": { "type": "object", "additionalProperties": false, "required": ["album", "track"], "properties": { "album": { "$ref": "#/$defs/card" }, "track": { "$ref": "#/$defs/card" } } },
      "headings": { "type": "object", "additionalProperties": false, "required": ["align", "separator", "background", "shadow"], "properties": { "align": { "enum": ["left", "center"] }, "separator": { "enum": ["line", "double", "block", "boxed", "none"] }, "background": { "$ref": "#/$defs/color" }, "shadow": { "enum": ["none", "soft", "hard"] } } },
      "buttons": { "type": "object", "additionalProperties": false, "required": ["preset", "hover", "click"], "properties": { "preset": { "enum": ["brutalist", "minimal", "neon", "pill", "ticket", "arcade", "metal", "paper"] }, "hover": { "enum": ["none", "lift", "glow", "invert"] }, "click": { "enum": ["none", "press", "pulse"] } } },
      "avatar": { "type": "object", "additionalProperties": false, "required": ["shape", "size", "background", "borderWidth", "borderColor", "shadow"], "properties": { "shape": { "enum": ["circle", "square", "rounded", "hexagon"] }, "size": { "type": "integer", "minimum": 72, "maximum": 220 }, "background": { "$ref": "#/$defs/color" }, "borderWidth": { "type": "integer", "minimum": 0, "maximum": 8 }, "borderColor": { "$ref": "#/$defs/color" }, "shadow": { "enum": ["none", "soft", "hard", "glow"] } } },
      "stats": { "type": "object", "additionalProperties": false, "required": ["variant"], "properties": { "variant": { "enum": ["grid", "cards", "hud", "bars", "tickets", "capsules", "giant"] } } },
      "podium": { "type": "object", "additionalProperties": false, "required": ["shape", "frame", "gold", "silver", "bronze"], "properties": { "shape": { "enum": ["circle", "square", "rounded", "hexagon"] }, "frame": { "enum": ["none", "line", "double", "medallion"] }, "gold": { "$ref": "#/$defs/color" }, "silver": { "$ref": "#/$defs/color" }, "bronze": { "$ref": "#/$defs/color" } } },
      "video": { "type": "object", "additionalProperties": false, "required": ["spacing"], "properties": { "spacing": { "type": "integer", "minimum": 0, "maximum": 36 } } },
      "decorations": { "type": "array", "maxItems": 8, "items": { "$ref": "#/$defs/decoration" } },
      "motion": { "type": "object", "additionalProperties": false, "required": ["entrance", "hover", "link", "counter", "duration"], "properties": { "entrance": { "enum": ["none", "fade", "slide"] }, "hover": { "enum": ["none", "lift", "zoom", "glow"] }, "link": { "enum": ["none", "underline"] }, "counter": { "enum": ["none", "count"] }, "duration": { "type": "integer", "minimum": 100, "maximum": 400 } } }
    },
    "$defs": {
      "color": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
      "uuid": { "type": "string", "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$" },
      "typography": { "type": "object", "additionalProperties": false, "required": ["family", "size", "weight", "letterSpacing", "lineHeight", "transform", "italic"], "properties": { "family": { "enum": ["space-grotesk", "dm-mono", "system-sans", "system-serif", "editorial-serif", "humanist-sans", "condensed-sans", "rounded-sans", "typewriter", "poster"] }, "size": { "type": "number" }, "weight": { "enum": [400, 500, 600, 700, 800] }, "letterSpacing": { "type": "number", "minimum": -0.05, "maximum": 0.2 }, "lineHeight": { "type": "number", "minimum": 0.9, "maximum": 1.9 }, "transform": { "enum": ["none", "uppercase", "lowercase"] }, "italic": { "type": "boolean" } } },
      "border": { "type": "object", "additionalProperties": false, "required": ["width", "style", "color"], "properties": { "width": { "type": "integer", "minimum": 0, "maximum": 8 }, "style": { "enum": ["none", "solid", "double", "dashed"] }, "color": { "$ref": "#/$defs/color" } } },
      "shadow": { "type": "object", "additionalProperties": false, "required": ["kind", "x", "y", "blur", "spread", "color"], "properties": { "kind": { "enum": ["none", "soft", "hard", "glow"] }, "x": { "type": "integer", "minimum": -16, "maximum": 16 }, "y": { "type": "integer", "minimum": -16, "maximum": 16 }, "blur": { "type": "integer", "minimum": 0, "maximum": 48 }, "spread": { "type": "integer", "minimum": 0, "maximum": 16 }, "color": { "$ref": "#/$defs/color" } } },
      "card": { "type": "object", "additionalProperties": false, "required": ["background", "textAlign", "titleScale", "imageFrame", "badgeStyle", "hover", "rotation"], "properties": { "background": { "$ref": "#/$defs/color" }, "textAlign": { "enum": ["left", "center"] }, "titleScale": { "type": "number", "minimum": 0.8, "maximum": 1.4 }, "imageFrame": { "enum": ["none", "line", "double"] }, "badgeStyle": { "enum": ["square", "soft", "pill"] }, "hover": { "enum": ["none", "lift", "zoom", "glow"] }, "rotation": { "type": "number", "minimum": -3, "maximum": 3 } } },
      "decoration": { "type": "object", "additionalProperties": false, "required": ["id", "assetId", "slot", "size", "opacity", "rotation", "mirror", "visibility", "alt"], "properties": { "id": { "$ref": "#/$defs/uuid" }, "assetId": { "$ref": "#/$defs/uuid" }, "slot": { "enum": ["page-top-left", "page-top-right", "header-background", "quiz-background", "podium-side", "stats-background", "between-sections", "page-bottom"] }, "size": { "type": "integer", "minimum": 24, "maximum": 320 }, "opacity": { "type": "number", "minimum": 0.1, "maximum": 1 }, "rotation": { "type": "integer", "minimum": -15, "maximum": 15 }, "mirror": { "type": "boolean" }, "visibility": { "enum": ["all", "desktop", "mobile"] }, "alt": { "type": "string", "maxLength": 160 } } },
      "borderTargets": { "type": "object", "additionalProperties": false, "required": ["header", "quiz", "albumCard", "trackCard", "podium", "video", "stats", "listened", "proposed", "bonus", "button", "badge"], "properties": { "header": { "$ref": "#/$defs/border" }, "quiz": { "$ref": "#/$defs/border" }, "albumCard": { "$ref": "#/$defs/border" }, "trackCard": { "$ref": "#/$defs/border" }, "podium": { "$ref": "#/$defs/border" }, "video": { "$ref": "#/$defs/border" }, "stats": { "$ref": "#/$defs/border" }, "listened": { "$ref": "#/$defs/border" }, "proposed": { "$ref": "#/$defs/border" }, "bonus": { "$ref": "#/$defs/border" }, "button": { "$ref": "#/$defs/border" }, "badge": { "$ref": "#/$defs/border" } } },
      "radiusTargets": { "type": "object", "additionalProperties": false, "required": ["header", "quiz", "albumCard", "trackCard", "podium", "video", "stats", "listened", "proposed", "bonus", "button", "badge"], "properties": { "header": { "type": "integer", "minimum": 0, "maximum": 48 }, "quiz": { "type": "integer", "minimum": 0, "maximum": 48 }, "albumCard": { "type": "integer", "minimum": 0, "maximum": 48 }, "trackCard": { "type": "integer", "minimum": 0, "maximum": 48 }, "podium": { "type": "integer", "minimum": 0, "maximum": 48 }, "video": { "type": "integer", "minimum": 0, "maximum": 48 }, "stats": { "type": "integer", "minimum": 0, "maximum": 48 }, "listened": { "type": "integer", "minimum": 0, "maximum": 48 }, "proposed": { "type": "integer", "minimum": 0, "maximum": 48 }, "bonus": { "type": "integer", "minimum": 0, "maximum": 48 }, "button": { "type": "integer", "minimum": 0, "maximum": 48 }, "badge": { "type": "integer", "minimum": 0, "maximum": 48 } } },
      "shadowTargets": { "type": "object", "additionalProperties": false, "required": ["header", "quiz", "albumCard", "trackCard", "podium", "video", "stats", "listened", "proposed", "bonus", "button", "badge"], "properties": { "header": { "$ref": "#/$defs/shadow" }, "quiz": { "$ref": "#/$defs/shadow" }, "albumCard": { "$ref": "#/$defs/shadow" }, "trackCard": { "$ref": "#/$defs/shadow" }, "podium": { "$ref": "#/$defs/shadow" }, "video": { "$ref": "#/$defs/shadow" }, "stats": { "$ref": "#/$defs/shadow" }, "listened": { "$ref": "#/$defs/shadow" }, "proposed": { "$ref": "#/$defs/shadow" }, "bonus": { "$ref": "#/$defs/shadow" }, "button": { "$ref": "#/$defs/shadow" }, "badge": { "$ref": "#/$defs/shadow" } } }
    }
  }
  $json$::json;
$$;

create or replace function public.profile_custom_theme_default_v1()
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  select $json$
  {
    "schemaVersion": 1,
    "inspirationSourceThemeId": null,
    "colors": { "page": "#F4F0E7", "surface": "#FFFDF7", "surfaceAlt": "#ECE7DA", "text": "#171715", "mutedText": "#5C5A54", "accent": "#E14832", "accentAlt": "#2148E8", "title": "#171715", "border": "#171715", "link": "#2148E8", "buttonBackground": "#E14832", "buttonText": "#FFFFFF", "badgeBackground": "#E14832", "badgeText": "#FFFFFF", "statBackground": "#D6F522", "statText": "#171715", "separator": "#171715" },
    "typography": { "display": { "family": "space-grotesk", "size": 56, "weight": 700, "letterSpacing": -0.03, "lineHeight": 1.02, "transform": "none", "italic": false }, "body": { "family": "space-grotesk", "size": 17, "weight": 400, "letterSpacing": 0, "lineHeight": 1.55, "transform": "none", "italic": false }, "label": { "family": "dm-mono", "size": 12, "weight": 500, "letterSpacing": 0.08, "lineHeight": 1.3, "transform": "uppercase", "italic": false }, "button": { "family": "dm-mono", "size": 13, "weight": 500, "letterSpacing": 0.04, "lineHeight": 1.2, "transform": "uppercase", "italic": false }, "stat": { "family": "space-grotesk", "size": 38, "weight": 700, "letterSpacing": -0.02, "lineHeight": 1, "transform": "none", "italic": false } },
    "backgrounds": { "mode": "solid", "color": "#F4F0E7", "gradient": { "from": "#F4F0E7", "to": "#ECE7DA", "angle": 135 }, "pattern": { "kind": "none", "color": "#171715", "scale": 24, "opacity": 0.12, "rotation": 0 }, "image": { "assetId": null, "opacity": 0.4, "position": "center", "size": "cover", "repeat": "no-repeat", "brightness": 1, "contrast": 1, "blur": 0 }, "overlay": { "color": "#F4F0E7", "opacity": 0 } },
    "borders": { "header": { "width": 1, "style": "solid", "color": "#171715" }, "quiz": { "width": 1, "style": "solid", "color": "#171715" }, "albumCard": { "width": 1, "style": "solid", "color": "#171715" }, "trackCard": { "width": 1, "style": "solid", "color": "#171715" }, "podium": { "width": 1, "style": "solid", "color": "#171715" }, "video": { "width": 1, "style": "solid", "color": "#171715" }, "stats": { "width": 1, "style": "solid", "color": "#171715" }, "listened": { "width": 1, "style": "solid", "color": "#171715" }, "proposed": { "width": 1, "style": "solid", "color": "#171715" }, "bonus": { "width": 1, "style": "solid", "color": "#171715" }, "button": { "width": 1, "style": "solid", "color": "#171715" }, "badge": { "width": 1, "style": "solid", "color": "#171715" } },
    "radii": { "header": 0, "quiz": 0, "albumCard": 0, "trackCard": 0, "podium": 0, "video": 0, "stats": 0, "listened": 0, "proposed": 0, "bonus": 0, "button": 0, "badge": 0 },
    "shadows": { "header": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "quiz": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "albumCard": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "trackCard": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "podium": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "video": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "stats": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "listened": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "proposed": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "bonus": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "button": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" }, "badge": { "kind": "none", "x": 0, "y": 0, "blur": 12, "spread": 0, "color": "#171715" } },
    "cards": { "album": { "background": "#FFFDF7", "textAlign": "left", "titleScale": 1, "imageFrame": "line", "badgeStyle": "square", "hover": "none", "rotation": 0 }, "track": { "background": "#FFFDF7", "textAlign": "left", "titleScale": 1, "imageFrame": "line", "badgeStyle": "square", "hover": "none", "rotation": 0 } },
    "headings": { "align": "left", "separator": "line", "background": "#FFFDF7", "shadow": "none" },
    "buttons": { "preset": "brutalist", "hover": "none", "click": "press" },
    "avatar": { "shape": "circle", "size": 144, "background": "#E14832", "borderWidth": 2, "borderColor": "#171715", "shadow": "none" },
    "stats": { "variant": "grid" },
    "podium": { "shape": "circle", "frame": "line", "gold": "#D3A735", "silver": "#AAB4BD", "bronze": "#B67544" },
    "video": { "spacing": 0 },
    "decorations": [],
    "motion": { "entrance": "none", "hover": "none", "link": "none", "counter": "none", "duration": 220 }
  }
  $json$::jsonb;
$$;

do $$
declare
  valid_config jsonb := public.profile_custom_theme_default_v1();
begin
  if not extensions.jsonb_matches_schema(public.profile_custom_theme_schema_v1(), valid_config) then
    raise exception 'pg_jsonschema rejected the valid custom theme fixture';
  end if;
  if extensions.jsonb_matches_schema(public.profile_custom_theme_schema_v1(), valid_config || '{"css":"display:none"}'::jsonb) then
    raise exception 'pg_jsonschema accepted an unknown CSS field';
  end if;
  if extensions.jsonb_matches_schema(public.profile_custom_theme_schema_v1(), jsonb_set(valid_config, '{motion,duration}', '999'::jsonb)) then
    raise exception 'pg_jsonschema accepted an out-of-range motion duration';
  end if;
  if extensions.jsonb_matches_schema(public.profile_custom_theme_schema_v1(), jsonb_set(valid_config, '{backgrounds,image,assetId}', '"https://example.com/x.svg"'::jsonb)) then
    raise exception 'pg_jsonschema accepted an external asset URL';
  end if;
end;
$$;

alter table public.member_public_profiles
  drop constraint if exists member_public_profiles_profile_theme_check;

alter table public.member_public_profiles
  add constraint member_public_profiles_profile_theme_check check (
    profile_theme in (
      'dol-ziklub',
      'archive', 'dark-vinyl', 'fanzine', 'neon-club', 'natural-tape',
      'chrome-2000', 'city-pop', 'punk-poster', 'jazz-lounge', 'acid-rave',
      'wheely', 'noir-cinema', 'manga-panel', 'cassette-sunset', 'museum-white',
      'custom'
    )
  );

create table public.profile_custom_theme_drafts (
  participant_id uuid primary key references public.member_public_profiles(id) on delete cascade,
  config jsonb not null,
  schema_version smallint not null default 1,
  revision bigint not null default 1,
  inspiration_source_theme_id text,
  tutorial_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_custom_theme_drafts_schema_version_check check (schema_version = 1),
  constraint profile_custom_theme_drafts_revision_check check (revision > 0),
  constraint profile_custom_theme_drafts_size_check check (octet_length(config::text) <= 65536),
  constraint profile_custom_theme_drafts_config_check check (extensions.jsonb_matches_schema(public.profile_custom_theme_schema_v1(), config))
);

create table public.profile_custom_theme_publications (
  participant_id uuid primary key references public.member_public_profiles(id) on delete cascade,
  config jsonb not null,
  schema_version smallint not null default 1,
  revision bigint not null,
  asset_ids uuid[] not null default '{}'::uuid[],
  published_at timestamptz not null default now(),
  constraint profile_custom_theme_publications_schema_version_check check (schema_version = 1),
  constraint profile_custom_theme_publications_revision_check check (revision > 0),
  constraint profile_custom_theme_publications_size_check check (octet_length(config::text) <= 65536),
  constraint profile_custom_theme_publications_assets_check check (cardinality(asset_ids) <= 9),
  constraint profile_custom_theme_publications_config_check check (extensions.jsonb_matches_schema(public.profile_custom_theme_schema_v1(), config))
);

create index profile_custom_theme_drafts_updated_idx on public.profile_custom_theme_drafts (updated_at desc);
create index profile_custom_theme_publications_published_idx on public.profile_custom_theme_publications (published_at desc);
create index profile_custom_theme_publications_assets_idx on public.profile_custom_theme_publications using gin (asset_ids);

alter table public.profile_custom_theme_drafts enable row level security;
alter table public.profile_custom_theme_publications enable row level security;

create policy "Members read their custom theme draft"
on public.profile_custom_theme_drafts for select to authenticated
using (participant_id = (select auth.uid()));

create policy "Members insert their custom theme draft"
on public.profile_custom_theme_drafts for insert to authenticated
with check (participant_id = (select auth.uid()));

create policy "Members update their custom theme draft"
on public.profile_custom_theme_drafts for update to authenticated
using (participant_id = (select auth.uid()))
with check (participant_id = (select auth.uid()));

create policy "Members delete their custom theme draft"
on public.profile_custom_theme_drafts for delete to authenticated
using (participant_id = (select auth.uid()));

create policy "Published custom themes are public"
on public.profile_custom_theme_publications for select to anon, authenticated
using (true);

revoke all on table public.profile_custom_theme_drafts from public, anon, authenticated;
grant select, insert, update, delete on table public.profile_custom_theme_drafts to authenticated;
revoke all on table public.profile_custom_theme_publications from public, anon, authenticated;
grant select on table public.profile_custom_theme_publications to anon, authenticated;

alter table public.profile_audit_log
  drop constraint if exists profile_audit_log_event_type_check;

alter table public.profile_audit_log
  add constraint profile_audit_log_event_type_check check (event_type in (
    'profile_theme_updated', 'profile_theme_reset', 'favorite_album_added',
    'favorite_album_updated', 'favorite_album_removed',
    'custom_theme_published', 'custom_theme_reset'
  ));

create or replace function public.profile_custom_theme_asset_is_published(p_asset_id uuid)
returns boolean
language sql
stable
security definer
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
security definer
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
create policy "Published custom theme assets are publicly readable"
on public.profile_custom_theme_assets for select to anon, authenticated
using (public.profile_custom_theme_asset_is_published(id));

drop policy if exists "Members delete their custom theme assets" on public.profile_custom_theme_assets;
drop policy if exists "profile theme asset owners can delete metadata" on public.profile_custom_theme_assets;
create policy "Members delete their custom theme assets"
on public.profile_custom_theme_assets for delete to authenticated
using (
  participant_id = (select auth.uid())
  and not public.profile_custom_theme_asset_is_referenced(id)
);

grant select on table public.profile_custom_theme_assets to anon;

drop policy if exists "Published custom theme objects are publicly readable" on storage.objects;
create policy "Published custom theme objects are publicly readable"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'profile-theme-assets'
  and exists (
    select 1 from public.profile_custom_theme_assets asset
    where asset.storage_path = name
      and public.profile_custom_theme_asset_is_published(asset.id)
  )
);

drop policy if exists "Members delete their custom theme objects" on storage.objects;
drop policy if exists "profile theme asset owners can delete objects" on storage.objects;
create policy "Members delete their custom theme objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-theme-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profile_custom_theme_assets asset
    where asset.storage_path = name
      and asset.participant_id = (select auth.uid())
      and not public.profile_custom_theme_asset_is_referenced(asset.id)
  )
);

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
  next_revision bigint;
  saved_at timestamptz := pg_catalog.now();
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'revision_invalid' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));
  if not extensions.jsonb_matches_schema(public.profile_custom_theme_schema_v1(), p_config) or octet_length(p_config::text) > 65536 then
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
    next_revision := 1;
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
  select * into current_draft from public.profile_custom_theme_drafts where participant_id = caller_id for update;
  if found and current_draft.revision <> p_expected_revision then raise exception 'revision_conflict' using errcode = '40001'; end if;
  if not found and p_expected_revision <> 0 then raise exception 'revision_conflict' using errcode = '40001'; end if;
  select * into current_publication from public.profile_custom_theme_publications where participant_id = caller_id;

  if current_publication.participant_id is null then
    delete from public.profile_custom_theme_drafts where participant_id = caller_id;
  else
    insert into public.profile_custom_theme_drafts (
      participant_id, config, schema_version, revision, inspiration_source_theme_id,
      tutorial_completed_at, created_at, updated_at
    ) values (
      caller_id, current_publication.config, 1, current_publication.revision,
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
  values (caller_id, caller_id, 'custom_theme_reset', jsonb_build_object('previous_revision', p_expected_revision));

  return jsonb_build_object(
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
  select * into current_draft
  from public.profile_custom_theme_drafts
  where participant_id = caller_id
  for update;
  if current_draft.participant_id is null then raise exception 'draft_missing' using errcode = 'P0002'; end if;
  if current_draft.revision <> expected_revision then raise exception 'revision_conflict' using errcode = '40001'; end if;

  select coalesce(array_agg(distinct reference.asset_id), '{}'::uuid[])
  into referenced_assets
  from (
    select nullif(current_draft.config #>> '{backgrounds,image,assetId}', '')::uuid as asset_id
    union all
    select (item ->> 'assetId')::uuid
    from jsonb_array_elements(current_draft.config -> 'decorations') item
  ) reference
  where reference.asset_id is not null;

  select count(*) into owned_asset_count
  from public.profile_custom_theme_assets asset
  where asset.participant_id = caller_id and asset.id = any(referenced_assets);
  if owned_asset_count <> cardinality(referenced_assets) then
    raise exception 'asset_not_owned' using errcode = '42501';
  end if;

  insert into public.profile_custom_theme_publications (
    participant_id, config, schema_version, revision, asset_ids, published_at
  ) values (
    caller_id, current_draft.config, 1, current_draft.revision, referenced_assets, published_at
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
  values (caller_id, caller_id, 'custom_theme_published', jsonb_build_object('revision', current_draft.revision, 'asset_ids', referenced_assets));

  return jsonb_build_object('revision', current_draft.revision, 'publishedAt', published_at, 'assetIds', referenced_assets);
end;
$$;

revoke all on function public.save_my_profile_custom_theme_draft(jsonb, bigint, boolean) from public, anon;
grant execute on function public.save_my_profile_custom_theme_draft(jsonb, bigint, boolean) to authenticated;
revoke all on function public.reset_my_profile_custom_theme_draft(bigint) from public, anon;
grant execute on function public.reset_my_profile_custom_theme_draft(bigint) to authenticated;
revoke all on function public.publish_my_profile_custom_theme(bigint) from public, anon;
grant execute on function public.publish_my_profile_custom_theme(bigint) to authenticated;

commit;
