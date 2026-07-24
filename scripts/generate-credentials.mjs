import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const outputDirectory = "generated-credentials";
const roster = JSON.parse(readFileSync(new URL("../src/data/members.json", import.meta.url), "utf8"));
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*+-_";
const internalDomain = "auth.dolziklub.local";
const apply = process.argv.includes("--apply");
const reconcile = process.argv.includes("--reconcile");
const usernameArgumentIndex = process.argv.indexOf("--username");
const requestedUsername = usernameArgumentIndex >= 0 ? process.argv[usernameArgumentIndex + 1]?.trim().toLowerCase() : null;

if (usernameArgumentIndex >= 0 && !requestedUsername) {
  console.error("L'option --username doit être suivie d'un identifiant.");
  process.exit(1);
}

const selectedRoster = requestedUsername
  ? roster.filter((member) => member.username?.toLowerCase() === requestedUsername)
  : roster;

if (requestedUsername && selectedRoster.length === 0) {
  console.error(`Membre introuvable dans le registre : ${requestedUsername}.`);
  process.exit(1);
}

if (existsSync(".env.production.local")) process.loadEnvFile(".env.production.local");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function password() {
  return Array.from(randomBytes(24), (byte) => alphabet[byte % alphabet.length]).join("");
}

function internalEmail(member) {
  return member.authEmail ?? `${member.username}@${internalDomain}`;
}

function writePrivateReadme(lines) {
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(`${outputDirectory}/README.txt`, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
}

if (!apply && !reconcile) {
  writePrivateReadme([
    "DOL ZIKLUB — dossier privé d’identifiants.",
    "Aucun compte n’a été créé : exécutez `npm run generate:credentials -- --apply` seulement après la migration Supabase.",
    "Ce dossier est volontairement ignoré par Git. Ne le partagez jamais publiquement.",
  ]);
  console.log("Mode sécurisé : aucun compte ni mot de passe généré. Ajoutez --apply pour provisionner les comptes.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Configuration absente : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires.");
  process.exit(1);
}

if (existsSync(outputDirectory) && !existsSync(`${outputDirectory}/README.txt`) && !requestedUsername) {
  console.error("Le dossier generated-credentials contient déjà des fichiers. Déplacez-les avant de relancer le provisionnement.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const created = [];
const skipped = [];

const syncMetadata = async (userId, member) => {
  const app_metadata = { role: member.role, username: member.username, display_name: member.displayName };
  const { error: userError } = await supabase.auth.admin.updateUserById(userId, { app_metadata });
  if (userError) return userError.message;
  const { error: profileError } = await supabase.from("member_profiles").update({
    username: member.username,
    display_name: member.displayName,
    role: member.role,
  }).eq("id", userId);
  return profileError?.message ?? null;
};

if (reconcile) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    console.error(`Impossible de lire les comptes existants : ${error.message}`);
    process.exit(1);
  }
  for (const member of selectedRoster) {
    if (!member.username) continue;
    const user = data.users.find((candidate) => candidate.email === internalEmail(member));
    if (!user) {
      skipped.push(`${member.displayName} : compte introuvable`);
      continue;
    }
    const errorMessage = await syncMetadata(user.id, member);
    if (errorMessage) skipped.push(`${member.displayName} : ${errorMessage}`);
    else created.push(`${member.displayName} (@${member.username})`);
  }
  console.log(`Synchronisation terminée : ${created.length} compte(s) mis à jour, ${skipped.length} ignoré(s).`);
  if (skipped.length) process.exitCode = 1;
  process.exit();
}

for (const member of selectedRoster) {
  if (!member.username) {
    skipped.push(`${member.displayName} : identifiant manquant`);
    continue;
  }
  if (existsSync(`${outputDirectory}/${member.username}.txt`)) {
    skipped.push(`${member.displayName} : une carte d’accès locale existe déjà (aucun écrasement)`);
    continue;
  }
  const secret = password();
  const { data, error } = await supabase.auth.admin.createUser({
    email: internalEmail(member),
    password: secret,
    email_confirm: true,
    app_metadata: { role: member.role, username: member.username, display_name: member.displayName },
  });

  if (error || !data.user) {
    skipped.push(`${member.displayName} : ${error?.message ?? "création impossible"}`);
    continue;
  }
  const metadataError = await syncMetadata(data.user.id, member);
  if (metadataError) {
    skipped.push(`${member.displayName} : métadonnées non synchronisées (${metadataError})`);
    continue;
  }

  const card = [
    "DOL ZIKLUB — accès personnel",
    "",
    `Membre : ${member.displayName}`,
    `Rôle : ${member.role === "admin" ? "administrateur" : "membre"}`,
    `Identifiant : ${member.username}`,
    `Mot de passe : ${secret}`,
    "",
    "Connexion : https://dolziklub.vercel.app/connexion",
    "Change ce mot de passe dès que la fonction de réinitialisation sera disponible.",
    "Ne transfère pas ce fichier dans un groupe public.",
  ].join("\n");
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(`${outputDirectory}/${member.username}.txt`, `${card}\n`, { encoding: "utf8", mode: 0o600 });
  created.push(`${member.displayName} (@${member.username})`);
}

writePrivateReadme([
  "DOL ZIKLUB — identifiants privés générés.",
  `Comptes créés : ${created.length}/${selectedRoster.length}.`,
  "Un fichier individuel est disponible pour chaque compte créé. Ce dossier est ignoré par Git.",
  ...(created.length ? ["", "Créés :", ...created.map((name) => `- ${name}`)] : []),
  ...(skipped.length ? ["", "Non créés :", ...skipped.map((name) => `- ${name}`)] : []),
]);

console.log(`Provisionnement terminé : ${created.length} compte(s) créé(s), ${skipped.length} ignoré(s).`);
if (skipped.length) process.exitCode = 1;
