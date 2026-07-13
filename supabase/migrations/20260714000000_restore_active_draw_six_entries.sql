-- Some member profiles were created after the initial seed ran. Recreate the
-- active draw idempotently so the Selection tab has real, editable rows.
insert into public.club_draws (draw_number, participant_usernames, status, published_at, avoid_repeated_pairs)
values (6, array['yuna', 'dod', 'enzo', 'thomas', 'motem', 'pep', 'chacha', 'bono'], 'published', now(), true)
on conflict (draw_number) do nothing;

with slots (position, proposer_username, listener_username, album_title, album_artist) as (
  values
    (1, 'yuna', 'enzo', null, null),
    (2, 'dod', 'thomas', 'Yeezus', 'Kanye West'),
    (3, 'enzo', 'motem', null, null),
    (4, 'thomas', 'pep', 'Pleins Phares, pt. 2', 'Favé'),
    (5, 'motem', 'yuna', '6 Feet Beneath the Moon', 'King Krule'),
    (6, 'pep', 'dod', 'FANTASYLAND', 'Mr.Fantasy'),
    (7, 'chacha', 'bono', null, null),
    (8, 'bono', 'chacha', null, null)
)
insert into public.club_draw_entries (
  draw_number, position, proposed_by, listened_by, proposed_by_name, listened_by_name, album_title, album_artist
)
select 6, slots.position, proposer.id, listener.id, slots.proposer_username, slots.listener_username, slots.album_title, slots.album_artist
from slots
join public.member_profiles as proposer on proposer.username = slots.proposer_username
join public.member_profiles as listener on listener.username = slots.listener_username
on conflict (draw_number, position) do nothing;
