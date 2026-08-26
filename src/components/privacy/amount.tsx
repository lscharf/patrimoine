import { cn } from "@/lib/utils";

/**
 * Enveloppe tout ce qui révèle un montant : euros, prix unitaires, quantités.
 *
 * Le masquage se fait en CSS, piloté par l'attribut `data-montants-masques`
 * posé sur `<html>`. Deux raisons à ce choix :
 *
 * - l'attribut est écrit au rendu serveur, à partir du cookie, donc les vrais
 *   montants ne s'affichent jamais, pas même une fraction de seconde ;
 * - la bascule côté client ne touche qu'un attribut, sans aller-retour serveur
 *   ni nouveau rendu.
 *
 * Le contenu reste dans le DOM : l'objectif est de pouvoir montrer son écran,
 * pas de résister à un inspecteur d'éléments.
 */
export function Montant({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span data-montant="" className={cn("inline-block", className)}>
      {children}
    </span>
  );
}
