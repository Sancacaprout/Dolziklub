# Couche Supabase

Les clients navigateur, serveur et administrateur sont volontairement séparés. Le client `admin.ts` est marqué `server-only` et ne doit jamais être importé depuis un composant client. Les migrations et RLS restent à produire après inspection du projet MCP cible : la session actuelle expose encore l’ancien projet, donc aucune écriture distante n’a été tentée.
