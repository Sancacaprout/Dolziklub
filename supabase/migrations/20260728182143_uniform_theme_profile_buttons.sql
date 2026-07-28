update public.site_updates
set display_order = case id
  when 'wheely-real-finale-unlock-fix' then 1
  when 'wheely-slide-jump-cancel' then 2
  when 'draw-deadline-timer-reminders' then 3
  when 'bonus-catalog-manual-deezer' then 4
  when 'wheely-reset-theme-refinements' then 5
  when 'profiles-bonus-wheely' then 6
  when 'draws-deezer-rankings' then 7
  when 'wheely-safari-launch' then 8
  else display_order
end
where id in (
  'wheely-real-finale-unlock-fix',
  'wheely-slide-jump-cancel',
  'draw-deadline-timer-reminders',
  'bonus-catalog-manual-deezer',
  'wheely-reset-theme-refinements',
  'profiles-bonus-wheely',
  'draws-deezer-rankings',
  'wheely-safari-launch'
);

insert into public.site_updates (id, published_on, display_order, content)
values (
  'uniform-theme-profile-buttons',
  date '2026-07-28',
  0,
  $$ {"version":"2.4","title":"Les aper\u00e7us de profils s\u2019alignent","summary":"Tous les th\u00e8mes affichent maintenant une action \u00ab Voir le profil \u00bb de m\u00eame taille, bien align\u00e9e au bas de chaque carte.","categories":["Correction","Am\u00e9lioration","Profil"],"added":[],"fixed":[{"text":"Les boutons de Punk Poster, Jazz Lounge et Acid Rave ne s\u2019agrandissent plus par rapport aux autres th\u00e8mes."},{"text":"Le bouton du th\u00e8me Wheely conserve d\u00e9sormais exactement la m\u00eame hauteur et le m\u00eame alignement que ses voisins."}],"improved":[{"text":"Une rang\u00e9e d\u2019action commune de 44 pixels garde toutes les cartes r\u00e9guli\u00e8res et tactiles, quelle que soit la longueur de leur contenu."}],"links":[{"label":"Choisir un th\u00e8me","href":"/compte"},{"label":"Voir les membres","href":"/membres"}]} $$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content;
