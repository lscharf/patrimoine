import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { safeRedirect } from "@/lib/safe-redirect";
import { allowlistConfigured, oidcEnabled } from "@/server/auth/config";
import { aucunCompteExistant } from "@/server/auth/first-run";
import { getSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connexion — Patrimoine" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const session = await getSession();
  const params = await searchParams;
  const redirectTo = safeRedirect(params.suite);

  if (session?.user) redirect(redirectTo);

  // Première installation : proposer la création du compte plutôt qu'un
  // formulaire de connexion sans issue.
  const premiereInstallation = aucunCompteExistant();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span
            className="size-6 rounded-lg bg-gradient-to-br from-accent to-accent-soft"
            aria-hidden
          />
          <span className="text-base font-semibold tracking-tight text-ink">
            Patrimoine
          </span>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-ink">
          {premiereInstallation ? "Créer votre accès" : "Connexion"}
        </h1>
        <p className="mt-1.5 mb-7 text-sm text-ink-muted">
          {premiereInstallation
            ? "Aucun compte n'existe encore. Ce formulaire ne s'affichera plus une fois le vôtre créé."
            : "Cette application donne accès à vos données financières."}
        </p>

        {!allowlistConfigured && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-hairline bg-negative-dim px-3.5 py-3 text-xs text-ink"
          >
            Aucune adresse autorisée n&apos;est configurée. Renseignez{" "}
            <code className="text-negative">AUTH_ALLOWED_EMAILS</code> dans
            votre fichier d&apos;environnement : sans elle, aucune connexion
            n&apos;est possible.
          </p>
        )}

        {premiereInstallation ? (
          <SignupForm redirectTo={redirectTo} />
        ) : (
          <LoginForm oidcEnabled={oidcEnabled} redirectTo={redirectTo} />
        )}
      </div>
    </main>
  );
}
