begin;

alter table public.club_draws
  add column if not exists historical_source text,
  add column if not exists historical_backfilled_at timestamptz,
  add column if not exists pairing_summary jsonb;

alter table public.club_draw_entries
  add column if not exists assigned_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists historical_source text,
  add column if not exists source_archive_album_id text;

alter table public.member_album_reviews
  add column if not exists historical_source text,
  add column if not exists original_submitted_at timestamptz;

alter table public.archived_album_reviews
  add column if not exists listener_id uuid references public.member_public_profiles(id) on delete set null,
  add column if not exists draw_entry_id uuid references public.club_draw_entries(id) on delete set null;

create index if not exists club_draw_entries_oriented_history_idx
  on public.club_draw_entries (proposed_by, listened_by, draw_number desc)
  where proposed_by is not null and listened_by is not null;
create index if not exists club_draw_entries_historical_source_idx
  on public.club_draw_entries (historical_source, draw_number, position);
create index if not exists archived_album_reviews_listener_id_idx
  on public.archived_album_reviews (listener_id);

create temporary table draw_history_seed (
  archive_number integer primary key,
  draw_number integer not null,
  position integer not null,
  title text not null,
  artist text not null,
  cover_url text,
  proposer_username text not null,
  listener_username text not null,
  rating numeric,
  review text,
  best_track text,
  worst_track text,
  album_url text
) on commit drop;

insert into draw_history_seed values
  (1, 1, 1, 'Bunka', 'EVE', '/covers/Bunka - EVE.png', 'Yuna', 'kougna', 2, 'moyen mais ok, rien de transcendant, dans la norme de ce genre de musique (pas tout écouté)', null, null, null),
  (2, 1, 2, 'L’école du micro d’argent', 'IAM', '/covers/L''École du micro d''argent - IAM.png', 'Pep', 'Enzo', 4, 'incr, bcp de messages, les prods incrrr, puis comment ils kickent rlarlarlrllralrla', 'La saga ft. Wu tang clan', 'Elle donne son corps avant son nom', null),
  (3, 1, 3, 'The Love Album', 'P. Diddy', '/covers/The Love Album - P. Diddy.png', 'kougna', 'Motem', 1, 'Pue sa mère, les textes sont rincés et les prods pas ouf + feats à chier', 'Boohoo', 'Tough love', null),
  (4, 1, 4, 'Gracias Compay', 'Compay segundo', '/covers/Gracias Compay - Compay Segundo.png', 'Motem', 'Dod', 2, 'sympa mais répétitif. La vibe est authentique, mais je pense que ça s''écoute mieux en fond', 'Virgen del Pino', 'Ataidi las flores de la vida', null),
  (5, 1, 5, 'Submarine', 'The marias', '/covers/Submarine - The Marías.png', 'Enzo', 'Pep', 3, 'inspi de fou entre chaque son kappa', 'Run your mouth', 'Lejos de Ti', null),
  (6, 1, 6, 'Born to die', 'Lana del Rey', '/covers/Born to Die - Lana Del Rey.png', 'Dod', 'Yuna', 4, 'Album très sympa à écouter lorsqu''on travaille ou pour juste chill', 'Million Dollar man', 'Off To The Races', null),
  (7, 1, 7, 'JOŸA', 'Tayc', '/covers/JOŸA - Tayc.png', 'Toma', 'Chacha', 4, 'L''ambiance est vraiment bien, mais les dialogues (monologue, entract...) cassent le rythme de l''album je trouve', 'Masterpiece', 'Prologue', null),
  (8, 1, 8, 'The Passionate Ones', 'Nourished by time', '/covers/The Passionate Ones - Nourished by Time.png', 'Bono', 'Yuna', 3, 'Des instrus et variantes intéressantes', 'It''s time', 'Idiots in the Park', null),
  (9, 1, 9, 'The Magic Whip', 'Blur', '/covers/The Magic Whip - Blur.png', 'Dod', 'Bono', 4, 'Nostalgique', 'They are too many of us', 'Mirrorball', null),
  (10, 1, 10, 'Projet blue beam', 'Freeze Corleone', '/covers/Projet Blue Beam - Freeze Corleone.png', 'kougna', 'Toma', 2, 'Connaissant déjà Freezer Corleone, je me suis vite habitué à son style;

Cependant, l''album est claqué au sol ya qu''un son de bien. Textes répétitifs, surtout comparés à "Shavkat", que je trouve bien plus travaillé. Morceaux 7 et 9 pas dispo sur Deezer;', 'Lester', 'Les 10 autres', null),
  (11, 2, 1, 'Land', 'Kekra', '/covers/Land - Kekra.png', 'Bono', 'Chacha', 3, 'Y a des rhytmes intéressant mais...

je trouve que la voix ne match pas à la musique sur certaines chansons. Quelques découvertes que j''aime bien dont la dernière musique de son album', 'Frérot', 'Normal (Interlude)', null),
  (12, 2, 2, 'THY WILL BE DONE', '$uicideboy$', '/covers/THY WILL BE DONE - $uicideboy$.png', 'Enzo', 'Toma', 4, 'Album assez sympa mais...

quand même un peu répétitif vers la fin. J''ai bien aimé les prods ça a un peu un style de Phonk j''aime bien. Le début de l''album est grave cool mais la fin un peu moins. Ça ne mérite pas 5 étoiles car pour moi il manque un son avec une meuf. Reply: 	Marquée comme fermée Reply: 	Rouverte', '2009 Reggie Bush', 'Hypernormalisation', null),
  (13, 2, 3, 'Pinkerton', 'Weezer', '/covers/Pinkerton - Weezer.png', 'Dod', 'Pep', 3, 'Album sympas d''un gars paumé en amour mais sans plus. Une bonne vibe mais rien de marquant.', 'The Good Life', 'Tired Of Sex', null),
  (14, 2, 4, 'Euphoria', 'Labrinth', '/covers/Euphoria - Labrinth.png', 'Yuna', 'Bono', 3, 'La grosse tete à Zendaya ...

Bono : Sa tête en plein millieu à croire que vous le fazites exprès pour m''énerver !  En vrai compliqué de jauger des soundtrack de film et/ou série. Tu peux pas être objectif par rapport à qqun qui aurait vu l''œuvre visuel+audio.', 'Still dont know my', 'New Girl', null),
  (15, 2, 5, 'Timely !!', 'Anri', '/covers/Timely!! - Anri.png', 'Pep', 'Yuna', 4, 'Album chill, j''aime beaucoup petit côté old school qu''on apprécie. It''s valideeyy !', 'I CAN''T STOP THE LONELINESS', 'Windy Summer', null),
  (16, 2, 6, 'Jeune Prince, Part. II', 'Rsko', '/covers/Jeune Prince, Part. II - Rsko.png', 'Toma', 'Motem', 2, 'Après les premiers sons je pensais que j''allais détester tout l''album, mais ...

agréablement surpris par certains titres.Le son en anglais est catastrophique. Des efforts d''articulations seraient appréciés également, Reply: 	Marquée comme fermée Reply: 	Rouverte', 'Daytona', '2MYROOM', null),
  (17, 2, 7, 'Le Klub des 7', 'Le klub des 7', '/covers/Le Klub des 7 - Le Klub des 7.png', 'Motem', 'Enzo', 1, 'Orfffff j''aime pas la sonorité mais...

je vois pourquoi tu a des gens qui aiment , ce groupe c''est pas des rappeur mais des MC le DJ c''est un disk jockey il mix pas il "toast" mais ouai pas mon genre', null, null, null),
  (18, 2, 8, 'Unter dem Eis', 'Eisblume', '/covers/Unter dem Eis - Eisblume.png', 'Chacha', 'Dod', 3, 'Evanessence en Allemand,  des suites d''accord originales

très sympa dans l''ensemble, la voix est très belle malgré que je ne comprenne pas un traître mot de ce qu''elle bafouille. Des choix de composition fortement appréciables viennent casser la monotonie que pourraient avoir certains morceaux, dédicace aux violons de "Stern" qui ont gorgé mon sexe de sang à leur écoute (erection). "Licht im Ozean" pourrait être une OST de SNK.', 'Stern', 'Dunkle sehnsucht', null),
  (19, 2, 9, 'Ipséité', 'Damso', '/covers/Ipséité - Damso.png', 'kougna', 'Dod', 3, 'Monsieur Dems apprécie les gros culs...

Je ne peux pas le juger pour autant ! Album plutôt sympathique, on a plusieurs ambiances, tantôt gros rap ghetto, tantôt zumba, seul fil conducteur : le SEXE, c''est le sujet qui revient, à certains moments je trouve ça appréciable, dans Gova par exemple la phrase "sperme dans les yeux, l''amour l''a-t-elle aveuglée ?" me fait rire et réfléchir en même temps, ou encore tout le son "une âme pour deux" que je ne peux pas décrire car il faut le vivre, mais au global je trouve le thème un peu léger et redondant, heureusement il articule, bien il sais raconter, les prods sont planantes et ça fait plaisir.', 'Une âme pour deux', 'Signaler', null),
  (20, 3, 1, '1.6 Live', 'TIF', '/covers/1.6 Live - TIF.png', 'Bono', 'Motem', 1, 'voidesque', 'SHADOW BOXING', 'HINATA', null),
  (21, 3, 2, 'Oracular Spectacular', 'MGMT', '/covers/Oracular Spectacular - MGMT.png', 'Motem', 'Toma', 5, 'Absolute Music

Nann cet album m’a rappelé une partie de mon enfance hell nah. It’s peak Reply: 	Marquée comme fermée Reply: 	Rouverte', 'Weekend Wars', 'Pieces of what', null),
  (22, 3, 3, 'Star', '2hollis', '/covers/Star - 2hollis.png', 'Enzo', 'Dod', 2, 'Beaucoup de choses à dire ...

J''aime l''ambiance, c''était fluide, ça se prête bien a de la musique d''ambiance, mais je trouve ça un peu mal équilibré.  Comme dans le titre Tell me, beaucoup de couplet un peu plat et le drop est pas mindblowing et trop court je trouve. Un peu répétitif sur les effets, Eldest child est super mal placée dans l''album juste après le son le plus puissant, un voix acoustique c''est pas ma tasse de thé et j''ai du mal à voir ce qu''il fait dans cet album. Pk ya un lion et des F1 en fond des phases parlées ??? Dédicace aux bruits de Feu d''artifice de Minecraft dans dream rain sports. J''ai pas détesté mais je suis pas sur le cul non plus.', 'Nerve', 'eldest child', null),
  (23, 3, 4, 'Infinity on High', 'Fall Out Boy', '/covers/Infinity on High - Fall Out Boy.png', 'Dod', 'Enzo', 3, 'Très sympa !

Très sympa, le groupe prend des risques même si ça reste une compo classique (le guitariste et le batteur banger eux deux on un bonne alchimie)  Le vocalist très sympa mais au fil du temp ça voix est ennuyante (même ton) mais très sympa l''écouter aller dans les aigu!', 'This ain''t a scene,', 'Hum hallelujah', null),
  (24, 3, 5, 'BDLM Vol.1', 'Tiakola', '/covers/BDLM Vol. 1 - Tiakola.png', 'Toma', 'Bono', 1, 'Pas prêt pour un voyage à Kinshasa', 'plaisir nocif', 'protect', null),
  (25, 3, 6, 'Blonde', 'Frank Ocean', '/covers/Blonde - Frank Ocean.png', 'Pep', 'Chacha', 5, 'L''ambiance me fait penser à du lofi en plus dynamique, je pourrai écouter l''album régulièrement tellement il est bien', 'Nights', 'Facebook story', null),
  (26, 3, 7, '2005', 'South Arcade', '/covers/2005 - South Arcade.png', 'Yuna', 'Pep', 3, 'Franchement j''aime bien, style rock epoque avril lavigne, mais pk de l''auto thune horrible la ?', '2005.0', 'Blood Run Warm', null),
  (27, 3, 8, 'PLAY!', 'South Arcade', '/covers/PLAY! - South Arcade.png', 'Yuna', 'Pep', 3, 'Franchement j''aime bien, style rock epoque avril lavigne, mais pk de l''auto thune horrible la ?', '2005.0', 'Blood Run Warm', null),
  (28, 3, 9, 'ピッパラの樹の下で', 'nano.RIPE', '/covers/ピッパラの樹の下で - nano.RIPE.png', 'Chacha', 'Yuna', 4, 'Vibe un peu J-Pop et J-Rock sur certains morceaux il n''en faut pas plus pour me convaincre, j''adore ❤️', 'Tsuki to Toki', 'Kumo no Otoshimono', null),
  (29, 4, 1, 'Phantom Island', 'King Gizzard & The Lizard Wizard', '/covers/Phantom Island - King Gizzard & The Lizard Wizard.png', 'Dod', 'Alain', null, null, null, null, null),
  (30, 4, 2, 'Marcos valle', 'Marcos valle', '/covers/Marcos Valle - Marcos Valle.png', 'Bono', 'Dod', 4, 'C''est le brésil, c''est le soleil, les favellas, c''est magnifique...

entre bangers qui donnent envie de twerker et balades de lovers très chill, gros respect aux compositeurs de bossa nova comme ce cher Marcos, c''est vraiment un style qui arrive a gaver d''accords et de mélodies tout en restant digeste. Je vais sûrement y revenir pour mettre l''ambiance.', 'Estrelar', 'Viola Enluarada', null),
  (31, 4, 3, 'Tonight Josephine!', 'Tape Five', '/covers/Tonight Josephine! - Tape Five.png', 'Alain', 'Toma', 5, 'Bon bah c''est une Masterclass ...

je m''attendais à ça de la part de Alain j''aime bien le côté de jazz et toutes les musiques sont bonnes c''est très cools à écouter. Cependant, si je devais faire un reproche, c''est que j''aimerais une mixité des voix, car dans l''album, il n''y a que un son avec un homme comme voix principale, c''est dommage, ne pas avoir exploiter davantage ce domaine', 'The Sky is not the limite', 'Alcazar', null),
  (32, 4, 4, 'American Idiot', 'Green Day', '/covers/American Idiot - Green Day.png', 'Chacha', 'Motem', 4, 'Juste envie de retourner au collège et de faire du skate', 'Jesus of Suburbia', 'She''s a rebel', null),
  (33, 4, 5, '15th anniversary Best', 'Maiko Fujita', '/covers/15th Anniversary Best - Maiko Fujita.png', 'Yuna', 'Chacha', 5, 'Merci pour ce moment d''introspection

Il n''y a aucune musique que je n''ai pas aimé, j''ai mis la dernière de l''album parce qu''elle signe la fin de l''album', '恋煩い', '秋風鈴', null),
  (34, 4, 6, 'MADRA', 'NEW DAD', '/covers/MADRA - NewDad.png', 'Enzo', 'Yuna', 4, 'J''aime beaucoup la vibe ...

et la voix de la chanteuse. Des morceaux très groovy, j''enlève juste une étoile car sur un album full certains morceaux peuvent sembler répétitif dans les notes.', 'Nightmare', 'In My Head', null),
  (35, 4, 7, 'The great Chinggis Khan', 'Batzorig Vaanching', '/covers/The Great Chinggis Khan - Batzorig Vaanchig.png', 'Motem', 'Pep', 4, 'Chinese Khan', 'Chinggis Khan', 'Galshariin magtaal', null),
  (36, 4, 8, 'Confiance', 'Kerchak', '/covers/Confiance - Kerchak.png', 'Toma', 'Enzo', 2, 'Rap new wave.

Mhhhhhh, alors  Il apporte vraiment une couleur qu''on manque en France et je le remercie bcp de ça  Mais ce qui me fait chier c''est comme assassin creed, tu écoute 4 ou 6 de ces musique tu a capté ce qu''il fait pas bcp de renouveau (ptet dans ces autre album ???) mais ouai un rap français qui m''ennuie les bpm son a la hauteur de mon ennuis (c''est un peu cru sry toma)  Mais encore une fois il apporte qu''elle que chose de fort et d''unique, ce qui est rare', 'peur ft ziak', 'percer', null),
  (37, 5, 1, 'Black Sunday', 'Cypress Hill', '/covers/Black Sunday - Cypress Hill.png', 'Pep', 'Bono', null, null, null, null, null),
  (38, 5, 2, 'All things must pass', 'George Harrison', '/covers/All Things Must Pass - George Harrison.png', 'Dod', 'Motem', null, null, null, null, null),
  (39, 5, 3, 'Moon Safari', 'Air', '/covers/Moon Safari - Air.png', 'Motem', 'Chacha', 5, 'Ca me rend nostalgique d''une époque que j''ai même pas connu !', 'Sexy Boy', 'La femme d''argent', null),
  (40, 5, 4, 'The Low End Theory', 'A Tribe Called Quest', '/covers/The Low End Theory - A Tribe Called Quest.png', 'Pep', 'Toma', 2, 'En sah

je me suis cru dans un sous-sol remplie de noir en train de se régler en 1vs1  battle de chant. L''album est cool mais TRES TRES TRES REPETITIF, les prods sont les même après pour les paroles je capte pas tout.', 'Jazz (We''ve Got)', 'Rap Promoter', null),
  (41, 5, 5, 'Best Day', 'LiSA', '/covers/Best Day - LiSA.png', 'Chacha', 'Pep', 4, 'La nostalgie, FUCKING WEEB', 'CROSSING FIELD', 'LiTTLE DEViL PARADE', null),
  (42, 5, 6, 'This is how tomorrow moves', 'beabadoobe', '/covers/This Is How Tomorrow Moves - beabadoobee.png', 'Enzo', 'Bono', null, null, null, null, null),
  (43, 5, 7, 'Hey u x', 'BENEE', '/covers/Hey u x - BENEE.png', 'Toma', 'Yuna', 4, 'j''ai kiffé', 'supalonely', 'sheesh', null),
  (44, 5, 8, 'ITEKOMA HITS', 'Otoboke Beaver', '/covers/ITEKOMA HITS - Otoboke Beaver.png', 'Dod', 'Enzo', 2, 'Mhhhhhhhhh

Je me suis ennuyé, je vois pas l''âme du projet  Elles sont très techniques c''est tout ce que j''ai apprécié du projet', 'Don''t Light my fire', null, null),
  (45, 5, 9, 'Sweet Boy', 'Malcolm Todd', '/covers/Sweet Boy - Malcolm Todd.png', 'Yuna', 'Dod', 3, 'J''ai bien aimé, et choqué par ...

la ressemblance folle avec le style de Steve Lacy ! D''après ce que j''ai pu lire il fait parti de ses influences majeures donc pas étonné. Bonne vibe indie, la ptite drum machine, les grattes un peu sales, peut-être une étoile en moins parce que c''est assez répétitif, la plupart des sons ont le même BPM, la même structure d''accord, ya pas vraiment de hauts et de bas l''album est plutôt plat dans le sens où il prend une recette qui marche et il duplique, mais je lui pardonne parce que malgré ça y''a toujours une ptite touche de mélancholie que j''apprécie fortement !', 'Art House', 'On my shoulder', null);
do $$
begin
  if exists (
    select 1
    from draw_history_seed seed
    cross join lateral unnest(array[seed.proposer_username, seed.listener_username]) historic(username)
    where not exists (
      select 1 from public.member_profiles profile
      where lower(profile.username) = case lower(historic.username) when 'toma' then 'thomas' else lower(historic.username) end
    )
  ) then
    raise exception 'Historical draw backfill stopped: at least one member alias has no stable identity';
  end if;
end;
$$;

with participants as (
  select seed.draw_number,
    array_agg(distinct case lower(historic.username) when 'toma' then 'thomas' else lower(historic.username) end
      order by case lower(historic.username) when 'toma' then 'thomas' else lower(historic.username) end) usernames
  from draw_history_seed seed
  cross join lateral unnest(array[seed.proposer_username, seed.listener_username]) historic(username)
  group by seed.draw_number
)
insert into public.club_draws (
  draw_number, participant_usernames, status, draw_type, avoid_repeated_pairs,
  historical_source, historical_backfilled_at
)
select draw_number, usernames, 'locked', 'standard', true, 'static-archive-v1', now()
from participants
on conflict (draw_number) do update
set participant_usernames = case
      when public.club_draws.historical_source = 'static-archive-v1' then excluded.participant_usernames
      else public.club_draws.participant_usernames
    end,
    historical_source = coalesce(public.club_draws.historical_source, excluded.historical_source),
    historical_backfilled_at = now();

insert into public.club_draw_entries (
  draw_number, position, proposed_by, listened_by, proposed_by_name, listened_by_name,
  album_title, album_artist, cover_source_url, youtube_music_url, archive_number,
  historical_source, source_archive_album_id
)
select seed.draw_number, seed.position, proposer.id, listener.id, proposer.username, listener.username,
  seed.title, seed.artist, seed.cover_url, seed.album_url, seed.archive_number,
  'static-archive-v1', 'archive-' || seed.archive_number
from draw_history_seed seed
join public.member_profiles proposer
  on lower(proposer.username) = case lower(seed.proposer_username) when 'toma' then 'thomas' else lower(seed.proposer_username) end
join public.member_profiles listener
  on lower(listener.username) = case lower(seed.listener_username) when 'toma' then 'thomas' else lower(seed.listener_username) end
on conflict (draw_number, position) do update
set proposed_by = coalesce(public.club_draw_entries.proposed_by, excluded.proposed_by),
    listened_by = coalesce(public.club_draw_entries.listened_by, excluded.listened_by),
    proposed_by_name = coalesce(public.club_draw_entries.proposed_by_name, excluded.proposed_by_name),
    listened_by_name = coalesce(public.club_draw_entries.listened_by_name, excluded.listened_by_name),
    album_title = coalesce(public.club_draw_entries.album_title, excluded.album_title),
    album_artist = coalesce(public.club_draw_entries.album_artist, excluded.album_artist),
    cover_source_url = coalesce(public.club_draw_entries.cover_source_url, excluded.cover_source_url),
    youtube_music_url = coalesce(public.club_draw_entries.youtube_music_url, excluded.youtube_music_url),
    archive_number = coalesce(public.club_draw_entries.archive_number, excluded.archive_number),
    historical_source = coalesce(public.club_draw_entries.historical_source, excluded.historical_source),
    source_archive_album_id = coalesce(public.club_draw_entries.source_archive_album_id, excluded.source_archive_album_id);

insert into public.member_album_reviews (
  album_id, member_id, review_title, review, rating, best_track, worst_track, historical_source
)
select entry.id::text, entry.listened_by, null, seed.review, seed.rating, seed.best_track, seed.worst_track, 'static-archive-v1'
from draw_history_seed seed
join public.club_draw_entries entry on entry.draw_number = seed.draw_number and entry.position = seed.position
where seed.rating is not null and nullif(btrim(seed.review), '') is not null and entry.listened_by is not null
on conflict (album_id, member_id) do update
set review = case when public.member_album_reviews.historical_source = 'static-archive-v1' then excluded.review else public.member_album_reviews.review end,
    rating = case when public.member_album_reviews.historical_source = 'static-archive-v1' then excluded.rating else public.member_album_reviews.rating end,
    best_track = coalesce(public.member_album_reviews.best_track, excluded.best_track),
    worst_track = coalesce(public.member_album_reviews.worst_track, excluded.worst_track),
    historical_source = coalesce(public.member_album_reviews.historical_source, excluded.historical_source);

update public.archived_album_reviews archived
set listener_id = coalesce(archived.listener_id, entry.listened_by),
    draw_entry_id = coalesce(archived.draw_entry_id, entry.id)
from public.club_draw_entries entry
where archived.album_id = entry.source_archive_album_id;

update public.club_draw_entries entry
set assigned_at = coalesce(entry.assigned_at, (
      select draw.created_at from public.club_draws draw where draw.draw_number = entry.draw_number
    )),
    completed_at = coalesce(entry.completed_at, (
      select review.created_at from public.member_album_reviews review where review.album_id = entry.id::text limit 1
    ))
where entry.historical_source is null;

drop function if exists public.get_public_draw_reviews();
create function public.get_public_draw_reviews()
returns table(
  album_id text, reviewer_id uuid, reviewer_username text, reviewer_display_name text, reviewer_avatar_path text,
  review_title text, review text, rating numeric, best_track text, worst_track text,
  best_track_youtube_music_url text, best_track_youtube_url text,
  worst_track_youtube_music_url text, worst_track_youtube_url text,
  created_at timestamptz, updated_at timestamptz
)
language sql security definer set search_path = '' stable
as $$
  select review.album_id, review.member_id, profile.username, profile.display_name, public_profile.avatar_path,
    review.review_title, review.review, review.rating, review.best_track, review.worst_track,
    best.youtube_music_url, best.youtube_url, worst.youtube_music_url, worst.youtube_url,
    review.created_at, review.updated_at
  from public.member_album_reviews review
  join public.club_draw_entries entry on entry.id::text = review.album_id
  join public.club_draws draw on draw.draw_number = entry.draw_number
  join public.member_profiles profile on profile.id = review.member_id
  left join public.member_public_profiles public_profile on public_profile.id = review.member_id
  left join public.album_track_selections best on best.review_id = review.id and best.selection_type = 'best'
  left join public.album_track_selections worst on worst.review_id = review.id and worst.selection_type = 'worst'
  where draw.status in ('published', 'locked')
    and nullif(btrim(entry.album_title), '') is not null
    and nullif(btrim(entry.album_artist), '') is not null;
$$;
revoke all on function public.get_public_draw_reviews() from public;
grant execute on function public.get_public_draw_reviews() to anon, authenticated;

create or replace function private.badge_snapshot(p_participant_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
with proposed_verdicts as (
  select case when draw.draw_type = 'global' then 'global:' || draw.draw_number else 'entry:' || entry.id end album_key,
    review.rating
  from public.club_draw_entries entry
  join public.club_draws draw on draw.draw_number = entry.draw_number
  join public.member_album_reviews review on review.album_id = entry.id::text
  where entry.proposed_by = p_participant_id and review.rating is not null
), proposed_albums as (
  select album_key, bool_or(rating >= 4) has_ge4, bool_or(rating <= 1) has_le1,
    bool_or(rating <= 2) has_le2, bool_or(rating = 5) has_5
  from proposed_verdicts group by album_key
), all_proposals as (
  select distinct case when draw.draw_type = 'global' then 'global:' || draw.draw_number else 'entry:' || entry.id end album_key
  from public.club_draw_entries entry join public.club_draws draw on draw.draw_number = entry.draw_number
  where entry.proposed_by = p_participant_id
    and nullif(btrim(entry.album_title), '') is not null and nullif(btrim(entry.album_artist), '') is not null
), reviews as (
  select 'official'::text kind, 'official:' || review.id review_key, review.review_title, review.review, review.rating,
    review.best_track, review.worst_track, coalesce(review.original_submitted_at, review.created_at) submitted_at,
    entry.assigned_at, case when entry.assigned_at is null then null else entry.assigned_at + interval '7 days' end deadline_at
  from public.member_album_reviews review
  join public.club_draw_entries entry on entry.id::text = review.album_id
  where review.member_id = p_participant_id
  union all
  select 'bonus', 'bonus:' || bonus.id, bonus.review_title, bonus.review, bonus.rating,
    bonus.best_track, bonus.worst_track, bonus.created_at, null, null
  from public.bonus_album_reviews bonus where bonus.member_id = p_participant_id
  union all
  select 'extra', 'extra:' || extra.id, extra.review_title, extra.review, extra.rating,
    extra.best_track, extra.worst_track, extra.reviewed_at, extra.requested_at, draw.created_at + interval '7 days'
  from public.extra_listening_requests extra join public.club_draws draw on draw.draw_number = extra.draw_number
  where extra.requester_id = p_participant_id and extra.status = 'reviewed'
), review_stats as (
  select count(*) filter(where kind='official')::integer official_count, count(*)::integer total_count,
    count(*) filter(where kind in ('bonus','extra'))::integer extra_count,
    count(*) filter(where nullif(btrim(review_title),'') is not null and nullif(btrim(review),'') is not null
      and rating is not null and nullif(btrim(best_track),'') is not null and nullif(btrim(worst_track),'') is not null)::integer complete_count,
    count(*) filter(where rating=5)::integer rating_5_count,
    count(*) filter(where rating<=1.5)::integer rating_low_count,
    count(*) filter(where rating is not null)::integer rating_count,
    avg(rating) filter(where rating is not null) rating_average,
    bool_or(rating=5) has_rating_5, bool_or(rating=1) has_rating_1
  from reviews
), launch as (select launched_at from private.badge_system_state where singleton), temporal as (
  select count(*) filter(where kind='official' and assigned_at>=launch.launched_at and submitted_at between assigned_at and assigned_at+interval '24 hours')::integer express_count,
    count(*) filter(where deadline_at is not null and assigned_at>=launch.launched_at and submitted_at between deadline_at-interval '24 hours' and deadline_at)::integer last_minute_count,
    count(*) filter(where kind='official' and deadline_at is not null and assigned_at>=launch.launched_at and submitted_at>=deadline_at+interval '30 days')::integer revenant_count
  from reviews cross join launch
), settled_assignments as (
  select entry.id, entry.draw_number, entry.position,
    (review.created_at is not null and entry.assigned_at is not null and review.created_at<=entry.assigned_at+interval '7 days') on_time,
    row_number() over(order by entry.draw_number desc,entry.position desc) sequence
  from public.club_draw_entries entry cross join launch
  left join public.member_album_reviews review on review.album_id=entry.id::text and review.member_id=p_participant_id
  where entry.listened_by=p_participant_id and entry.assigned_at>=launch.launched_at
    and (review.id is not null or entry.assigned_at+interval '7 days'<=now())
), streak as (
  select count(*)::integer on_time_streak from settled_assignments
  where on_time and sequence<coalesce((select min(sequence) from settled_assignments where not on_time),2147483647)
)
select jsonb_build_object(
  'proposalCount',(select count(*) from all_proposals),'proposalGe4Count',(select count(*) from proposed_albums where has_ge4),
  'proposalLe1Count',(select count(*) from proposed_albums where has_le1),'proposalLe2Count',(select count(*) from proposed_albums where has_le2),
  'proposal5Count',(select count(*) from proposed_albums where has_5),'officialCount',coalesce(review_stats.official_count,0),
  'totalCount',coalesce(review_stats.total_count,0),'extraCount',coalesce(review_stats.extra_count,0),
  'completeCount',coalesce(review_stats.complete_count,0),'rating5Count',coalesce(review_stats.rating_5_count,0),
  'ratingLowCount',coalesce(review_stats.rating_low_count,0),'ratingCount',coalesce(review_stats.rating_count,0),
  'ratingAverage',review_stats.rating_average,'hasRating5',coalesce(review_stats.has_rating_5,false),
  'hasRating1',coalesce(review_stats.has_rating_1,false),'onTimeStreak',coalesce(streak.on_time_streak,0),
  'expressCount',coalesce(temporal.express_count,0),'lastMinuteCount',coalesce(temporal.last_minute_count,0),
  'revenantCount',coalesce(temporal.revenant_count,0)
) from review_stats cross join temporal cross join streak;
$$;
revoke all on function private.badge_snapshot(uuid) from public, anon, authenticated;

create table if not exists private.badge_recalculation_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  applied boolean not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.admin_recalculate_all_badges(p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare profile record; before_count integer; after_count integer; unlocked integer; members jsonb := '[]'::jsonb; result jsonb;
begin
  perform private.require_draw_admin();
  for profile in select id, username from public.member_profiles order by username loop
    select count(*) into before_count from public.participant_badges where participant_id = profile.id;
    unlocked := case when p_apply then private.evaluate_badges(profile.id, 'history-backfill', 'draws-1-8', true) else 0 end;
    select count(*) into after_count from public.participant_badges where participant_id = profile.id;
    members := members || jsonb_build_array(jsonb_build_object(
      'participantId', profile.id, 'username', profile.username, 'snapshot', private.badge_snapshot(profile.id),
      'before', before_count, 'after', after_count, 'unlocked', unlocked
    ));
  end loop;
  result := jsonb_build_object('applied', p_apply, 'members', members, 'generatedAt', now());
  insert into private.badge_recalculation_log(actor_id, applied, report) values(auth.uid(), p_apply, result);
  return result;
end;
$$;
revoke all on function public.admin_recalculate_all_badges(boolean) from public, anon;
grant execute on function public.admin_recalculate_all_badges(boolean) to authenticated;

create or replace function public.admin_create_classic_draw_from_assignments(
  p_proposer_ids uuid[], p_listener_ids uuid[], p_pairing_summary jsonb default '{}'::jsonb
) returns integer language plpgsql security definer set search_path = '' as $$
declare next_draw integer; participant_names text[]; row_count integer;
begin
  perform private.require_draw_admin();
  row_count := cardinality(p_proposer_ids);
  if row_count < 2 or row_count > 18 or row_count <> cardinality(p_listener_ids) then raise exception 'Invalid assignment count'; end if;
  if (select count(distinct id) from unnest(p_proposer_ids) id) <> row_count
    or (select count(distinct id) from unnest(p_listener_ids) id) <> row_count
    or exists(select 1 from generate_subscripts(p_proposer_ids,1) slot where p_proposer_ids[slot]=p_listener_ids[slot])
    or not (select array_agg(id order by id) from unnest(p_proposer_ids) id) = (select array_agg(id order by id) from unnest(p_listener_ids) id)
    or (select count(*) from public.member_profiles where id = any(p_proposer_ids)) <> row_count then
    raise exception 'Assignments must contain every stable participant exactly once in each role without self-pairs';
  end if;
  select array_agg(lower(username) order by lower(username)) into participant_names from public.member_profiles where id = any(p_proposer_ids);
  select greatest(coalesce(max(draw_number),0),6)+1 into next_draw from public.club_draws;
  insert into public.club_draws(draw_number,participant_usernames,status,avoid_repeated_pairs,draw_type,pairing_summary)
  values(next_draw,participant_names,'draft',true,'standard',coalesce(p_pairing_summary,'{}'::jsonb));
  insert into public.club_draw_entries(draw_number,position,proposed_by,listened_by,proposed_by_name,listened_by_name,assigned_at)
  select next_draw, slot, proposer.id, listener.id, proposer.username, listener.username, now()
  from generate_subscripts(p_proposer_ids,1) slot
  join public.member_profiles proposer on proposer.id=p_proposer_ids[slot]
  join public.member_profiles listener on listener.id=p_listener_ids[slot];
  return next_draw;
end;
$$;
revoke all on function public.admin_create_classic_draw_from_assignments(uuid[],uuid[],jsonb) from public, anon;
grant execute on function public.admin_create_classic_draw_from_assignments(uuid[],uuid[],jsonb) to authenticated;

create or replace function public.admin_replace_classic_draw_assignments(
  p_draw_number integer, p_proposer_ids uuid[], p_listener_ids uuid[], p_pairing_summary jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare draw public.club_draws%rowtype; row_count integer;
begin
  perform private.require_draw_admin();
  select * into draw from public.club_draws where draw_number=p_draw_number for update;
  row_count := cardinality(p_proposer_ids);
  if draw.draw_number is null or draw.status <> 'draft' or draw.draw_type <> 'standard' then raise exception 'Only a classic draft can be regenerated'; end if;
  if exists(select 1 from public.club_draw_entries where draw_number=p_draw_number and (album_title is not null or album_artist is not null)) then raise exception 'A draft containing an album cannot be regenerated'; end if;
  if row_count <> cardinality(draw.participant_usernames) or row_count <> cardinality(p_listener_ids)
    or (select count(distinct id) from unnest(p_proposer_ids) id) <> row_count
    or (select count(distinct id) from unnest(p_listener_ids) id) <> row_count
    or exists(select 1 from generate_subscripts(p_proposer_ids,1) slot where p_proposer_ids[slot]=p_listener_ids[slot])
    or not (select array_agg(id order by id) from unnest(p_proposer_ids) id) = (select array_agg(id order by id) from unnest(p_listener_ids) id) then
    raise exception 'Invalid regenerated assignments';
  end if;
  delete from public.club_draw_entries where draw_number=p_draw_number;
  insert into public.club_draw_entries(draw_number,position,proposed_by,listened_by,proposed_by_name,listened_by_name,assigned_at)
  select p_draw_number, slot, proposer.id, listener.id, proposer.username, listener.username, now()
  from generate_subscripts(p_proposer_ids,1) slot
  join public.member_profiles proposer on proposer.id=p_proposer_ids[slot]
  join public.member_profiles listener on listener.id=p_listener_ids[slot];
  update public.club_draws set pairing_summary=coalesce(p_pairing_summary,'{}'::jsonb) where draw_number=p_draw_number;
end;
$$;
revoke all on function public.admin_replace_classic_draw_assignments(integer,uuid[],uuid[],jsonb) from public, anon;
grant execute on function public.admin_replace_classic_draw_assignments(integer,uuid[],uuid[],jsonb) to authenticated;

do $ declare profile record; begin
  for profile in select id from public.member_profiles loop
    perform private.evaluate_badges(profile.id, 'history-backfill', 'draws-1-8', true);
  end loop;
end $;

insert into private.badge_recalculation_log(actor_id, applied, report)
select null, true, jsonb_build_object(
  'source', 'draws-1-8-history-backfill',
  'totalBadges', (select count(*) from public.participant_badges),
  'members', coalesce(jsonb_agg(jsonb_build_object(
    'participantId', profile.id, 'username', profile.username,
    'badgeCount', (select count(*) from public.participant_badges badge where badge.participant_id=profile.id),
    'snapshot', private.badge_snapshot(profile.id)
  ) order by profile.username), '[]'::jsonb)
)
from public.member_profiles profile;

commit;
