"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui";
import { COOKIE_MASQUE } from "@/lib/privacy";

/**
 * Bascule l'affichage des montants.
 *
 * L'état vit sur `<html>` et dans un cookie. On ne passe pas par un état React
 * partagé : l'attribut est déjà posé par le serveur au premier rendu, et le
 * modifier directement évite de re-rendre tout l'arbre à chaque clic.
 */
export function PrivacyToggle({ initial }: { initial: boolean }) {
  const [masque, setMasque] = useState(initial);

  function basculer() {
    const suivant = !masque;
    setMasque(suivant);
    document.documentElement.toggleAttribute("data-montants-masques", suivant);
    document.cookie = `${COOKIE_MASQUE}=${suivant ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={basculer}
      aria-pressed={masque}
      aria-label={masque ? "Afficher les montants" : "Masquer les montants"}
      title={masque ? "Afficher les montants" : "Masquer les montants"}
    >
      {masque ? (
        <EyeOff className="size-4" aria-hidden />
      ) : (
        <Eye className="size-4" aria-hidden />
      )}
    </Button>
  );
}
