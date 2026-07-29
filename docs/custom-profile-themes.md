# Thèmes de profil personnalisés

## Déploiement

La fonctionnalité est contrôlée côté serveur par `PROFILE_CUSTOM_THEME_EDITOR_ENABLED`.
Elle doit rester désactivée tant que les migrations et le smoke test de la Preview protégée ne sont pas validés. Les modifications intermédiaires utilisent des déploiements Vercel Preview ; une seule promotion Production est prévue.

La désactivation du flag masque l’éditeur, ferme les routes API et force un profil publié en `custom` à revenir visuellement au thème DOL ZIKLUB sans supprimer son brouillon ni sa publication.

## Contrat visuel

Le site conserve l’ordre, la présence et la disposition fonctionnelle de toutes les sections. Le thème ne reçoit que des tokens visuels structurés et validés : couleurs, typographies contrôlées, fonds, cadres, rayons, ombres, cartes, avatar, statistiques, podium, vidéo, décorations et mouvements bornés.

- Aucun CSS, HTML, JavaScript ou URL externe n’est accepté.
- Les clés inconnues sont refusées.
- La configuration V1 est limitée à 64 Kio.
- Les huit décorations utilisent uniquement des emplacements définis par le site.
- Les identifiants d’assets sont des UUID ; les URLs signées ne sont jamais stockées dans la configuration.
- `prefers-reduced-motion` neutralise les mouvements.

Le contrat TypeScript se trouve dans `src/lib/profile-custom-theme/`. Le compilateur n’émet que des variables CSS explicites et des classes prédéfinies sous `[data-profile-theme="custom"]`.

## États et flux

Les quatre états exposés par `GET /api/profile-theme/draft` sont déterministes :

1. `never` : aucun brouillon et aucune publication ;
2. `draft` : brouillon privé sans publication ;
3. `published` : brouillon et publication à la même révision ;
4. `changes` : brouillon plus récent que la publication.

Les micro-modifications restent locales. `POST /api/profile-theme/draft` enregistre explicitement le brouillon avec contrôle optimiste de révision. `POST /api/profile-theme/publish` appelle une fonction transactionnelle qui copie le brouillon, vérifie la propriété de chaque asset, active `profile_theme = 'custom'` et écrit l’audit. Aucun Realtime n’est utilisé.

Les révisions sont monotones. Si un brouillon est supprimé directement après une publication, la prochaine sauvegarde repart de `révision publiée + 1`.

## Supabase et RLS

`participant_id` référence `public.member_public_profiles(id)`. Dans ce domaine, cet identifiant correspond à `auth.uid()` via la relation existante avec `auth.users`; les policies utilisent donc `participant_id = (select auth.uid())`.

- `profile_custom_theme_drafts` : lecture/écriture du propriétaire authentifié uniquement ;
- `profile_custom_theme_publications` : lecture publique, aucune écriture Data API ;
- `profile_custom_theme_assets` et bucket privé `profile-theme-assets` : lecture du propriétaire ou d’un asset publié ; suppression impossible tant que l’asset est référencé ;
- RPC d’écriture : `SECURITY DEFINER`, `search_path = ''`, identité dérivée de `auth.uid()`, aucun `participant_id` fourni par le client, exécution refusée à `PUBLIC` et `anon` ;
- helpers de lecture d’assets : `SECURITY INVOKER`.

`pg_jsonschema` 0.3.3 est activé parce qu’il protège aussi les appels PostgREST directs. Les colonnes `config` possèdent une contrainte `extensions.jsonb_matches_schema`; la migration exécute un fixture valide et trois fixtures hostiles dans sa transaction.

Migrations :

- `20260729182644_profile_custom_theme_assets.sql` ;
- `20260729195758_profile_custom_theme_publication_workflow.sql` ;
- `20260729203013_harden_custom_theme_asset_policies.sql` ;
- `20260729203517_keep_custom_theme_revisions_monotonic.sql`.

## Images

La route `/api/profile-theme/assets` utilise le runtime Node.js et `sharp@0.34.5` direct : JPEG/PNG/WebP, 5 Mo en entrée, décodage réel, 25 mégapixels maximum, orientation corrigée, métadonnées retirées, 2048×2048 maximum et WebP de 1,5 Mo maximum.

Le stockage garde des chemins immuables `<auth.uid()>/<asset-id>.webp`. Un profil public ne signe que les UUID copiés dans sa publication courante. Un asset non publié reste privé.

## Vérifications avant Production

- `npm test` ;
- `npm run lint -- --max-warnings=20` ;
- build Production avec le flag activé ;
- tests RLS `anon`, membre A et membre B ;
- conflit de révision et recréation monotone ;
- upload/affichage/suppression Sharp dans une vraie Preview Vercel ;
- profil sans configuration, brouillon privé, publication, visiteur, mobile et thèmes existants ;
- advisors Supabase, avec justification des trois RPC d’écriture privilégiées ;
- vérification qu’aucun abonnement Realtime n’existe dans ce flux.

## Retour arrière

Revenir au déploiement Vercel précédent ou désactiver le flag retire immédiatement l’éditeur et le rendu personnalisé. Les tables restent rétrocompatibles et inertes ; aucune donnée d’album, morceau, artiste, clip, statistique, avis, note ou tirage n’est modifiée.

## Entrée « Mises à jour » préparée

À publier uniquement après le smoke test du déploiement Production, avec la date/heure Europe/Paris réelle :

> Tu peux maintenant créer ton propre thème de profil : couleurs, polices, fonds, cartes, motifs, images décoratives et bien plus encore. La structure du profil reste stable, mais son apparence peut devenir entièrement personnelle.
