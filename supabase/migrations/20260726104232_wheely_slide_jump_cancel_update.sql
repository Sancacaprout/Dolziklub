update public.site_updates
set display_order = case id
  when 'draw-deadline-timer-reminders' then 1
  when 'bonus-catalog-manual-deezer' then 2
  when 'wheely-reset-theme-refinements' then 3
  else display_order
end
where id in (
  'draw-deadline-timer-reminders',
  'bonus-catalog-manual-deezer',
  'wheely-reset-theme-refinements'
);

insert into public.site_updates (id, published_on, display_order, content)
values (
  'wheely-slide-jump-cancel',
  date '2026-07-26',
  0,
  $$ {"version":"2.2","title":"La glissade de Wheely devient annulable","summary":"Un saut peut maintenant interrompre une roulade apr\u00e8s un court d\u00e9lai de protection de 0,1 seconde.","categories":["Correction","Am\u00e9lioration"],"added":[],"fixed":[{"text":"Pendant une glissade, la commande de saut rel\u00e8ve maintenant Wheely et d\u00e9clenche imm\u00e9diatement un saut normal."},{"text":"Les 100 premi\u00e8res millisecondes de la roulade restent prot\u00e9g\u00e9es pour \u00e9viter une annulation instantan\u00e9e de l\u2019animation."}],"improved":[{"text":"Les commandes sont plus coh\u00e9rentes : la glissade acc\u00e9l\u00e8re d\u00e9j\u00e0 la descente d\u2019un saut, et le saut peut d\u00e9sormais sortir d\u2019une glissade."}],"links":[{"label":"Jouer \u00e0 Wheely","href":"/"}] } $$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content;
