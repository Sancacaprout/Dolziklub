-- Bonus availability is based only on the real draw assignment. Official
-- reviews, ratings and draw lifecycle are deliberately not eligibility gates.
create or replace function public.save_my_bonus_album_review(
  p_entry_id uuid,
  p_archive_album_id text,
  p_review_title text,
  p_review text,
  p_rating numeric,
  p_best_track text,
  p_worst_track text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_member_id uuid := (select auth.uid());
  saved_review_id uuid;
begin
  if current_member_id is null then
    raise exception 'Authentication required';
  end if;
  if p_review is null or char_length(btrim(p_review)) = 0 then
    raise exception 'A review is required';
  end if;
  if p_rating is null or p_rating < 0 or p_rating > 5
     or p_rating * 2 <> trunc(p_rating * 2) then
    raise exception 'Rating must be between 0 and 5 in half steps';
  end if;
  if num_nonnulls(p_entry_id, p_archive_album_id) <> 1 then
    raise exception 'Choose exactly one album';
  end if;
  if not exists (
    select 1
    from public.member_profiles as profile
    where profile.id = current_member_id
  ) then
    raise exception 'Member profile not found';
  end if;

  if p_entry_id is not null then
    if not exists (
      select 1
      from public.club_draw_entries as entry
      where entry.id = p_entry_id
        and nullif(btrim(entry.album_title), '') is not null
        and nullif(btrim(entry.album_artist), '') is not null
    ) then
      raise exception 'Choose an album from a draw';
    end if;

    insert into public.bonus_album_reviews (
      entry_id, archive_album_id, member_id, review_title, review, rating,
      best_track, worst_track
    ) values (
      p_entry_id, null, current_member_id, nullif(btrim(p_review_title), ''),
      btrim(p_review), p_rating, nullif(btrim(p_best_track), ''),
      nullif(btrim(p_worst_track), '')
    )
    on conflict (entry_id, member_id) where entry_id is not null do update
    set review_title = excluded.review_title,
        review = excluded.review,
        rating = excluded.rating,
        best_track = excluded.best_track,
        worst_track = excluded.worst_track
    returning id into saved_review_id;
  else
    if p_archive_album_id !~ '^archive-[0-9]+$' or not exists (
      select 1
      from public.archived_album_reviews as archive_review
      where archive_review.album_id = p_archive_album_id
    ) then
      raise exception 'Choose an archived album from a draw';
    end if;

    insert into public.bonus_album_reviews (
      entry_id, archive_album_id, member_id, review_title, review, rating,
      best_track, worst_track
    ) values (
      null, p_archive_album_id, current_member_id,
      nullif(btrim(p_review_title), ''), btrim(p_review), p_rating,
      nullif(btrim(p_best_track), ''), nullif(btrim(p_worst_track), '')
    )
    on conflict (archive_album_id, member_id)
      where archive_album_id is not null do update
    set review_title = excluded.review_title,
        review = excluded.review,
        rating = excluded.rating,
        best_track = excluded.best_track,
        worst_track = excluded.worst_track
    returning id into saved_review_id;
  end if;

  return saved_review_id;
end;
$$;

revoke all on function public.save_my_bonus_album_review(
  uuid, text, text, text, numeric, text, text
) from public, anon;
grant execute on function public.save_my_bonus_album_review(
  uuid, text, text, text, numeric, text, text
) to authenticated;

-- Persist the same dated release note used by the application fallback.
insert into public.site_updates (id, published_on, display_order, content)
values (
  'bonus-catalog-manual-deezer',
  date '2026-07-26',
  0,
  $$ {"version":"2.0","title":"Toutes les \u00e9coutes bonus, Deezer uniquement sur demande","summary":"Chaque album renseign\u00e9 dans un tirage devient imm\u00e9diatement disponible en \u00e9coute bonus et la recherche Deezer attend maintenant un clic explicite.","categories":["Correction","Am\u00e9lioration","Albums","Tirages","\u00c9coutes bonus"],"added":[],"fixed":[{"text":"Les albums sans note, sans avis ou encore en attente apparaissent d\u00e9sormais dans les \u00e9coutes bonus d\u00e8s qu\u2019ils sont renseign\u00e9s dans un tirage."},{"text":"Les anciens tirages, le tirage en cours et les prochains tirages utilisent la m\u00eame source dynamique, sans cr\u00e9er de faux avis."},{"text":"La recherche Deezer d\u2019albums ne se lance plus pendant la saisie et part une seule fois apr\u00e8s un clic sur \u00ab RECHERCHER SUR DEEZER \u00bb."}],"improved":[{"text":"Deezer affiche jusqu\u2019\u00e0 cinq albums probables, class\u00e9s selon le titre, l\u2019artiste, la proximit\u00e9 textuelle, la popularit\u00e9 et l\u2019ordre du catalogue."},{"text":"Chaque r\u00e9sultat conserve sa pochette, son lien Deezer et son identifiant catalogue jusqu\u2019\u00e0 la confirmation manuelle."}],"links":[{"label":"Ouvrir les \u00e9coutes bonus","href":"/tableur"},{"label":"Modifier mes albums favoris","href":"/compte"}] } $$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content;
