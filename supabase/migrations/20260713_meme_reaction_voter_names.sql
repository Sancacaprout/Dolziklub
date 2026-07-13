-- Each signed-in member vote permanently carries the public club pseudo of its author.
alter table public.meme_reactions
  add column if not exists author_name text;

update public.meme_reactions as reaction
set author_name = coalesce(
  (select '@' || profile.username from public.member_profiles as profile where profile.id = reaction.user_id),
  '@membre'
)
where reaction.author_name is null;

alter table public.meme_reactions
  drop constraint if exists meme_reactions_author_name_check;

alter table public.meme_reactions
  add constraint meme_reactions_author_name_check
  check (char_length(btrim(author_name)) between 2 and 83);

create or replace function private.prepare_meme_reaction_author()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select '@' || profile.username
    into new.author_name
    from public.member_profiles as profile
   where profile.id = new.user_id;

  if new.author_name is null then
    raise exception 'A club profile is required to react to a meme';
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_meme_reaction_author() from public;

drop trigger if exists meme_reactions_set_author_name on public.meme_reactions;
create trigger meme_reactions_set_author_name
before insert or update of user_id on public.meme_reactions
for each row execute function private.prepare_meme_reaction_author();

grant select (meme_id, value, author_name, created_at, updated_at) on table public.meme_reactions to anon;
grant select (meme_id, user_id, value, author_name, created_at, updated_at) on table public.meme_reactions to authenticated;
