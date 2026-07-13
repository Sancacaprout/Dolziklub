import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*+-_";
export function generateTemporaryPassword() { return Array.from(randomBytes(24), byte => alphabet[byte % alphabet.length]).join(""); }
mkdirSync("generated-credentials", { recursive: true });
writeFileSync("generated-credentials/README.txt", "Générateur prêt. Ajoutez les participants validés avant exécution réelle. Ne versionnez jamais ce dossier.\n", "utf8");
console.log("Aucun identifiant généré : les participants doivent d’abord être validés dans les données source.");
