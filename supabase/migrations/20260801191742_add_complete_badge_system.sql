-- Complete, server-authoritative badge system.
-- Conditions are evaluated inside database transactions. Clients can only
-- read their collection, claim an unlock and manage three public slots.

create table private.badge_definitions (
  badge_key text primary key check (badge_key ~ '^b(0[1-9]|1[0-9]|2[0-9])$'),
  display_order smallint not null unique check (display_order between 1 and 29),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null check (char_length(btrim(description)) between 4 and 240),
  category text not null check (category in ('proposal', 'listening', 'review', 'game', 'tribunal')),
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'legendary')),
  is_secret boolean not null default false,
  image_path text not null unique check (image_path ~ '^/badges/b(0[1-9]|1[0-9]|2[0-9])\.png$'),
  progress_target numeric,
  active boolean not null default true
);

insert into private.badge_definitions
  (badge_key, display_order, name, description, category, rarity, is_secret, image_path, progress_target)
values
  ('b01',1,'Première galette','Proposer un premier album au club.','proposal','common',false,'/badges/b01.png',1),
  ('b02',2,'Fournisseur officiel','Proposer 5 albums différents au club.','proposal','common',false,'/badges/b02.png',5),
  ('b03',3,'Disquaire du club','Proposer 20 albums différents au club.','proposal','rare',false,'/badges/b03.png',20),
  ('b04',4,'Catalogue humain','Proposer 30 albums différents au club.','proposal','legendary',false,'/badges/b04.png',30),
  ('b05',5,'Triple validation','Faire noter au moins 4/5 trois albums proposés différents.','proposal','rare',false,'/badges/b05.png',3),
  ('b06',6,'Proposition criminelle','Faire noter 1/5 ou moins un album proposé.','proposal','uncommon',true,'/badges/b06.png',1),
  ('b07',7,'Sans aucun remords','Faire noter 2/5 ou moins trois albums proposés différents.','proposal','rare',false,'/badges/b07.png',3),
  ('b08',8,'La classe à Dallas','Faire noter 5/5 trois albums proposés différents.','proposal','legendary',false,'/badges/b08.png',3),
  ('b09',9,'Premier verdict','Publier un premier avis officiel.','review','common',false,'/badges/b09.png',1),
  ('b10',10,'Oreilles ouvertes','Terminer 5 écoutes officielles.','listening','common',false,'/badges/b10.png',5),
  ('b11',11,'Auditeur confirmé','Terminer 20 écoutes officielles.','listening','rare',false,'/badges/b11.png',20),
  ('b12',12,'Machine à écouter','Terminer 30 écoutes, tous parcours confondus.','listening','legendary',false,'/badges/b12.png',30),
  ('b13',13,'Travail supplémentaire','Terminer une première écoute bonus ou supplémentaire.','listening','common',false,'/badges/b13.png',1),
  ('b14',14,'Heures supplémentaires','Terminer 5 écoutes bonus ou supplémentaires.','listening','rare',false,'/badges/b14.png',5),
  ('b15',15,'Aucun album abandonné','Enchaîner 10 écoutes officielles sans retard ni abandon.','listening','legendary',true,'/badges/b15.png',10),
  ('b16',16,'Critique appliqué','Publier 10 avis complets avec titre, texte, note et morceaux marquants.','review','uncommon',false,'/badges/b16.png',10),
  ('b17',17,'La plume du club','Publier 25 avis complets.','review','legendary',false,'/badges/b17.png',25),
  ('b18',18,'Cœur d’artichaut','Attribuer la note de 5/5 trois fois.','review','rare',false,'/badges/b18.png',3),
  ('b19',19,'Incorruptible','Attribuer une note de 1,5/5 ou moins trois fois.','review','rare',false,'/badges/b19.png',3),
  ('b20',20,'Le juste milieu','Conserver une moyenne entre 2,9 et 3,1 après au moins 10 notes.','review','rare',false,'/badges/b20.png',10),
  ('b21',21,'Tout ou rien','Attribuer au moins une note de 5/5 et une note de 1/5.','review','uncommon',false,'/badges/b21.png',2),
  ('b22',22,'Public difficile','Conserver une moyenne inférieure à 2,5 après au moins 10 notes.','review','rare',false,'/badges/b22.png',10),
  ('b23',23,'Bon public','Conserver une moyenne supérieure à 3,8 après au moins 10 notes.','review','rare',false,'/badges/b23.png',10),
  ('b24',24,'Premier tour de piste','Terminer une première face dans le jeu Wheely.','game','uncommon',false,'/badges/b24.png',1),
  ('b25',25,'Wheely Rider','Atteindre l’objectif final et débloquer le thème Wheely.','game','legendary',false,'/badges/b25.png',1),
  ('b26',26,'Victime du Tribunal','Être le membre le plus cité lors d’une édition clôturée du Tribunal.','tribunal','legendary',true,'/badges/b26.png',1),
  ('b27',27,'Express','Rendre un avis officiel dans les 24 heures suivant l’affectation.','review','rare',false,'/badges/b27.png',1),
  ('b28',28,'Dernière minute','Rendre trois avis dans les dernières 24 heures avant leur échéance.','review','rare',false,'/badges/b28.png',3),
  ('b29',29,'Revenant','Rendre un avis officiel au moins 30 jours après son échéance.','review','legendary',true,'/badges/b29.png',1);

alter table private.badge_definitions enable row level security;
revoke all on table private.badge_definitions from public, anon, authenticated;

create table private.badge_system_state (
  singleton boolean primary key default true check (singleton),
  launched_at timestamptz not null default now()
);
insert into private.badge_system_state (singleton) values (true) on conflict do nothing;
alter table private.badge_system_state enable row level security;
revoke all on table private.badge_system_state from public, anon, authenticated;

create table public.participant_badges (
  participant_id uuid not null references public.member_public_profiles(id) on delete cascade,
  badge_key text not null references private.badge_definitions(badge_key) on delete restrict,
  unlocked_at timestamptz not null default now(),
  claimed_at timestamptz,
  unlock_source text not null check (char_length(btrim(unlock_source)) between 2 and 80),
  source_reference text,
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  primary key (participant_id, badge_key),
  check (claimed_at is null or claimed_at >= unlocked_at)
);
create index participant_badges_unclaimed_idx on public.participant_badges (participant_id, unlocked_at) where claimed_at is null;
alter table public.participant_badges enable row level security;
revoke all on table public.participant_badges from public, anon, authenticated;
grant select on table public.participant_badges to authenticated;
create policy "Members read their own badges" on public.participant_badges for select to authenticated
  using (participant_id = (select auth.uid()));
create policy "Administrators read all badges" on public.participant_badges for select to authenticated
  using ((select private.is_member_admin()));

create table public.participant_badge_slots (
  participant_id uuid not null,
  slot smallint not null check (slot between 1 and 3),
  badge_key text not null,
  equipped_at timestamptz not null default now(),
  primary key (participant_id, slot),
  unique (participant_id, badge_key),
  foreign key (participant_id, badge_key) references public.participant_badges(participant_id, badge_key) on delete cascade
);
create index participant_badge_slots_public_idx on public.participant_badge_slots (participant_id, slot);
alter table public.participant_badge_slots enable row level security;
revoke all on table public.participant_badge_slots from public, anon, authenticated;
grant select on table public.participant_badge_slots to anon, authenticated;
create policy "Equipped badges are publicly readable" on public.participant_badge_slots
  for select to anon, authenticated using (true);

alter table public.member_notifications drop constraint if exists member_notifications_kind_check;
alter table public.member_notifications add constraint member_notifications_kind_check
  check (kind = any (array['meme','album','review','draw','task','comment','extra_request','badge']));
