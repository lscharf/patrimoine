"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button, Input, Label, Separator } from "@/components/ui";
import { signIn } from "@/lib/auth-client";

export function LoginForm({
  oidcEnabled,
  redirectTo,
}: {
  oidcEnabled: boolean;
  redirectTo: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [oidcPending, setOidcPending] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const { error } = await signIn.email({ email, password });
      if (error) {
        // Message uniforme : distinguer « adresse inconnue » de « mot de passe
        // incorrect » permettrait d'énumérer les comptes existants.
        setError("Adresse ou mot de passe incorrect.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  async function signInWithAuthelia() {
    setError(null);
    setOidcPending(true);
    const { error } = await signIn.social({
      provider: "authelia",
      callbackURL: redirectTo,
    });
    if (error) {
      setError("La connexion via Authelia a échoué.");
      setOidcPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {oidcEnabled && (
        <>
          <Button
            type="button"
            className="w-full"
            loading={oidcPending}
            onClick={signInWithAuthelia}
          >
            <ShieldCheck className="size-4" aria-hidden />
            Se connecter avec Authelia
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-ink-faint">ou</span>
            <Separator className="flex-1" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            autoFocus={!oidcEnabled}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant={oidcEnabled ? "secondary" : "primary"}
          className="w-full"
          loading={pending}
        >
          <KeyRound className="size-4" aria-hidden />
          Se connecter
        </Button>
      </form>
    </div>
  );
}
