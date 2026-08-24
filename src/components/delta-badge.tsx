import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatPercent, formatSignedCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  /** Variation en euros */
  value: number | null | undefined;
  /** Variation relative, sous forme de ratio (0.1064 → 10,64 %) */
  pct?: number | null;
  /** N'affiche que le pourcentage */
  pctOnly?: boolean;
  className?: string;
};

/** Sous ce seuil, une variation est traitée comme nulle plutôt que colorée. */
const FLAT = 0.005;

export function deltaTrend(value: number | null | undefined): "up" | "down" | "flat" {
  if (value == null || Math.abs(value) < FLAT) return "flat";
  return value > 0 ? "up" : "down";
}

export function DeltaBadge({ value, pct, pctOnly, className }: Props) {
  const trend = deltaTrend(pctOnly ? (pct ?? 0) * 100 : value);
  const Icon = trend === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <Badge
      variant={trend === "up" ? "positive" : trend === "down" ? "negative" : "neutral"}
      className={cn("tnum gap-0.5", className)}
      icon={trend !== "flat" ? <Icon className="size-3" aria-hidden /> : undefined}
    >
      {pctOnly
        ? formatPercent(pct, { signed: true })
        : formatSignedCurrency(value)}
      {!pctOnly && pct != null && (
        <span className="ml-1 opacity-60">{formatPercent(pct, { signed: true })}</span>
      )}
    </Badge>
  );
}
