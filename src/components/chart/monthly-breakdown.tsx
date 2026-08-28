"use client";

import { Montant } from "@/components/privacy/amount";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MonthlyBreakdownProps {
  monthlyPayment: number;
  monthlyPrincipal: number;
  monthlyInterest: number;
  monthlyInsurance: number;
  reimbursedPct?: number;
  className?: string;
}

export function MonthlyBreakdown({
  monthlyPayment,
  monthlyPrincipal,
  monthlyInterest,
  monthlyInsurance,
  className,
}: MonthlyBreakdownProps) {
  const total = Math.max(monthlyPayment, 1);
  const principalRatio = monthlyPrincipal / total;
  const interestRatio = monthlyInterest / total;
  const insuranceRatio = monthlyInsurance / total;

  // SVG Arc Donut calculation
  const size = 120;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Offsets for the three segments
  const principalStroke = principalRatio * circumference;
  const interestStroke = interestRatio * circumference;
  const insuranceStroke = insuranceRatio * circumference;

  const principalOffset = 0;
  const interestOffset = -principalStroke;
  const insuranceOffset = -(principalStroke + interestStroke);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* Donut circulaire de la mensualité */}
        <div className="relative flex size-[120px] shrink-0 items-center justify-center">
          <svg width={size} height={size} className="-rotate-90">
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--color-hairline)"
              strokeWidth={strokeWidth}
            />
            {/* Capital segment (Bleu) */}
            {monthlyPrincipal > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#60a5fa"
                strokeWidth={strokeWidth}
                strokeDasharray={`${principalStroke} ${circumference - principalStroke}`}
                strokeDashoffset={principalOffset}
                strokeLinecap="round"
              />
            )}
            {/* Intérêts segment (Rose / Magenta) */}
            {monthlyInterest > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#f472b6"
                strokeWidth={strokeWidth}
                strokeDasharray={`${interestStroke} ${circumference - interestStroke}`}
                strokeDashoffset={interestOffset}
              />
            )}
            {/* Assurance segment (Violet / Ardoise) */}
            {monthlyInsurance > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#a78bfa"
                strokeWidth={strokeWidth}
                strokeDasharray={`${insuranceStroke} ${circumference - insuranceStroke}`}
                strokeDashoffset={insuranceOffset}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="tnum text-sm font-semibold text-ink">
              <Montant>{formatCurrency(monthlyPayment)}</Montant>
            </span>
            <span className="text-[10px] text-ink-faint">/mois</span>
          </div>
        </div>

        {/* Détails et barres segmentées par composante */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Ligne Capital */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#60a5fa]" />
                <span className="text-ink-muted">Capital</span>
              </div>
              <span className="tnum font-medium text-ink">
                <Montant>{formatCurrency(monthlyPrincipal)}</Montant>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-[#60a5fa] transition-all"
                style={{ width: `${Math.round(principalRatio * 100)}%` }}
              />
            </div>
          </div>

          {/* Ligne Intérêts */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#f472b6]" />
                <span className="text-ink-muted">Intérêts</span>
              </div>
              <span className="tnum font-medium text-ink">
                <Montant>{formatCurrency(monthlyInterest)}</Montant>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-[#f472b6] transition-all"
                style={{ width: `${Math.round(interestRatio * 100)}%` }}
              />
            </div>
          </div>

          {/* Ligne Assurance */}
          {monthlyInsurance > 0 ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-[#a78bfa]" />
                  <span className="text-ink-muted">Assurance</span>
                </div>
                <span className="tnum font-medium text-ink">
                  <Montant>{formatCurrency(monthlyInsurance)}</Montant>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-[#a78bfa] transition-all"
                  style={{ width: `${Math.round(insuranceRatio * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-ink-faint">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-hairline" />
                <span>Assurance</span>
              </div>
              <span>—</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
