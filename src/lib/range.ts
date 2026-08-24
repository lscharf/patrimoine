import { RANGES, type Range } from "@/server/portfolio/types";

/**
 * Lit et valide le paramètre d'URL `?p=`.
 *
 * Volontairement hors du module du sélecteur : celui-ci est un composant
 * client, et un composant serveur ne peut pas appeler une fonction qui vit
 * dans un module marqué `"use client"`.
 */
export function parseRange(raw: string | string[] | undefined): Range {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (RANGES as readonly string[]).includes(v ?? "") ? (v as Range) : "1M";
}
