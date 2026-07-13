# Authentification DOL ZIKLUB

La connexion utilise un identifiant de club et un mot de passe. Sous le capot, l’identifiant est converti en adresse interne `identifiant@auth.dolziklub.local` afin de s’appuyer sur Supabase Auth sans exposer d’adresse e-mail personnelle.

1. Relier le bon projet Supabase, puis appliquer `supabase/migrations/20260713_member_auth.sql`.
2. Configurer `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dans Vercel pour le navigateur. Dans le dossier du projet local, placer uniquement `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local` pour le provisionnement : le script le charge sans le publier.
3. Exécuter `npm run generate:credentials -- --apply` dans un environnement local protégé.
4. Distribuer les fichiers individuels de `generated-credentials/` par un canal privé et supprimer la copie locale une fois la distribution terminée.

Le rôle est placé dans `app_metadata`, écrit uniquement via l’API administrateur. La clé `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais apparaître dans le navigateur, dans Git, ni dans un message de discussion. La table `member_profiles` est protégée par RLS : un membre lit uniquement son profil, un administrateur peut lire les profils du club.
