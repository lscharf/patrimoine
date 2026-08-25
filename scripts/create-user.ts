/**
 * Création du compte d'accès — `npm run auth:user`.
 *
 * Le mot de passe est saisi de façon interactive, sans écho. Il n'est
 * volontairement **pas** acceptable en argument de ligne de commande : il
 * atterrirait dans l'historique du shell et serait visible dans `ps`.
 */
import readline from "node:readline";
import { auth, allowlistConfigured, isEmailAllowed } from "@/server/auth/config";
import { sqlite } from "@/db";

function ask(prompt: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  if (hidden) {
    // Neutralise l'écho : readline continue de lire, mais n'affiche rien.
    const target = rl as unknown as { _writeToOutput: (s: string) => void };
    const original = target._writeToOutput.bind(rl);
    let armed = false;
    target._writeToOutput = (chunk: string) => {
      if (!armed) {
        original(chunk);
        armed = true;
        return;
      }
      // Ne réécrit que l'invite, jamais les caractères saisis.
    };
  }
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      if (hidden) process.stdout.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  if (process.argv.some((a) => a.startsWith("--password"))) {
    console.error(
      "Le mot de passe ne se passe pas en argument : il resterait dans\n" +
        "l'historique du shell et serait lisible dans `ps`. Relancez sans\n" +
        "l'option, il vous sera demandé de façon masquée.",
    );
    process.exitCode = 1;
    return;
  }

  if (!allowlistConfigured) {
    console.error(
      "AUTH_ALLOWED_EMAILS n'est pas renseigné.\n" +
        "Aucune adresse n'est autorisée, donc aucun compte ne peut être créé.\n" +
        "Ajoutez par exemple : AUTH_ALLOWED_EMAILS=vous@exemple.fr",
    );
    process.exitCode = 1;
    return;
  }

  const email = await ask("Adresse e-mail : ");
  if (!isEmailAllowed(email)) {
    console.error(
      `\n« ${email} » ne figure pas dans AUTH_ALLOWED_EMAILS.\n` +
        "Ajoutez cette adresse à la liste blanche puis relancez.",
    );
    process.exitCode = 1;
    return;
  }

  const name = (await ask("Nom affiché : ")) || email.split("@")[0];
  const password = await ask("Mot de passe (12 caractères minimum) : ", true);
  if (password.length < 12) {
    console.error("\nMot de passe trop court : 12 caractères minimum.");
    process.exitCode = 1;
    return;
  }
  const confirm = await ask("Confirmez le mot de passe : ", true);
  if (password !== confirm) {
    console.error("\nLes deux saisies diffèrent.");
    process.exitCode = 1;
    return;
  }

  try {
    await auth.api.signUpEmail({ body: { email, name, password } });
    console.log(`\n✓ Compte créé pour ${email}.`);
    console.log(
      "  Les comptes du portefeuille existants lui ont été rattachés.",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/already exists|UNIQUE/i.test(message)) {
      console.error(`\nUn compte existe déjà pour ${email}.`);
    } else {
      console.error(`\nÉchec de la création : ${message}`);
    }
    process.exitCode = 1;
  }
}

main().finally(() => sqlite.close());
