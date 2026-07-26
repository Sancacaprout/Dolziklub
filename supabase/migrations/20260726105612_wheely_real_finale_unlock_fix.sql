update public.site_updates
set display_order = case id
  when 'wheely-slide-jump-cancel' then 1
  when 'draw-deadline-timer-reminders' then 2
  when 'bonus-catalog-manual-deezer' then 3
  when 'wheely-reset-theme-refinements' then 4
  else display_order
end
where id in (
  'wheely-slide-jump-cancel',
  'draw-deadline-timer-reminders',
  'bonus-catalog-manual-deezer',
  'wheely-reset-theme-refinements'
);

insert into public.site_updates (id, published_on, display_order, content)
values (
  'wheely-real-finale-unlock-fix',
  date '2026-07-26',
  0,
  $$ {"version":"2.3","title":"Wheely gagne une vraie ligne d\u2019arriv\u00e9e","summary":"La fin du morceau devient une s\u00e9quence \u00e0 part enti\u00e8re et le d\u00e9blocage du th\u00e8me est fiabilis\u00e9 de bout en bout.","categories":["Correction","Am\u00e9lioration"],"added":[{"text":"\u00c0 la derni\u00e8re note, un vinyle anim\u00e9 ralentit et referme la face avant l\u2019affichage du score final."}],"fixed":[{"text":"La configuration serveur du d\u00e9blocage Wheely est maintenant exig\u00e9e au d\u00e9ploiement afin que chaque victoire connect\u00e9e puisse enregistrer l\u2019achievement."},{"text":"Les appels de d\u00e9but et de fin de partie sont retent\u00e9s automatiquement en cas de panne r\u00e9seau temporaire, puis l\u2019\u00e9criture est relue dans la base avant d\u2019annoncer le th\u00e8me comme d\u00e9bloqu\u00e9."}],"improved":[{"text":"D\u00e8s la fin de la musique, aucun obstacle ni mur d\u2019album suppl\u00e9mentaire n\u2019appara\u00eet ; les \u00e9l\u00e9ments en piste sortent sans provoquer de collision."}],"links":[{"label":"Jouer \u00e0 Wheely","href":"/"},{"label":"Choisir le th\u00e8me","href":"/compte"}] } $$::jsonb
)
on conflict (id) do update
set published_on = excluded.published_on,
    display_order = excluded.display_order,
    content = excluded.content;
