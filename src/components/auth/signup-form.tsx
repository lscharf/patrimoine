"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

const LONGUEUR_MINIMALE = 12;

export function SignupForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);

    if (motDePasse.length < LONGUEUR_MINIMALE) {
      setErreur(`Le mot de passe doit faire au moins ${LONGUEUR_MINIMALE} caractères.`);
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux saisies diffèrent.");
      return;
    }

    start(async () => {
      const { error } = await authClient.signUp.email({
        email,
        name: nom || email.split("@")[0],
        password: motDePasse,
      });
      if (error) {
        // Le refus vient presque toujours de la liste blanche : on le dit,
        // c'est la seule erreur que l'utilisateur peut corriger lui-même.
        setErreur(
          error.status === 403
            ? "Cette adresse ne figure pas dans AUTH_ALLOWED_EMAILS."
            : "La création du compte a échoué.",
        );
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nom">Nom affiché</Label>
        <Input
          id="nom"
          autoComplete="name"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="facultatif"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={LONGUEUR_MINIMALE}
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
        />
        <p className="text-[11px] text-ink-faint">
          {LONGUEUR_MINIMALE} caractères minimum.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirmation</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </div>

      {erreur && (
        <p role="alert" className="text-sm text-negative">
          {erreur}
        </p>
      )}

      <Button type="submit" className="w-full" loading={pending}>
        <UserPlus className="size-4" aria-hidden />
        Créer le compte
      </Button>
    </form>
  );
}
