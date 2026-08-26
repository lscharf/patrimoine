"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { curveMonotoneX } from "@visx/curve";
import { LinearGradient } from "@visx/gradient";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { AreaClosed, LinePath } from "@visx/shape";
import { scaleLinear, scaleTime } from "@visx/scale";
import { localPoint } from "@visx/event";
import { cn } from "@/lib/utils";
import { Montant } from "@/components/privacy/amount";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { SeriesPoint } from "@/server/portfolio/types";

const MARGIN = { top: 16, right: 8, bottom: 26, left: 8 };
/** Marge verticale autour de la courbe, en fraction de son amplitude. */
const Y_PADDING = 0.12;

type Props = {
  points: SeriesPoint[];
  /** Référence de début de période : trace la ligne de seuil. */
  baseline?: number;
  intraday?: boolean;
  /** Colore la courbe selon le signe de la performance de la période. */
  trend?: "up" | "down" | "flat";
  className?: string;
};

/** Index du point le plus proche d'un timestamp — la série est triée. */
function nearestIndex(points: SeriesPoint[], t: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1].t - t) < Math.abs(points[lo].t - t)) {
    return lo - 1;
  }
  return lo;
}

function Chart({
  width,
  height,
  points,
  baseline,
  intraday,
  trend = "flat",
}: Props & { width: number; height: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const { xScale, yScale } = useMemo(() => {
    const xs = points.map((p) => p.t);
    const ys = points.map((p) => p.v);
    if (baseline != null) ys.push(baseline);

    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // Une série strictement plate donnerait une amplitude nulle : on force
    // une hauteur minimale pour que la ligne ne colle pas au bord.
    const span = maxY - minY || Math.max(Math.abs(maxY) * 0.02, 1);
    const pad = span * Y_PADDING;

    return {
      xScale: scaleTime({
        domain: [new Date(Math.min(...xs)), new Date(Math.max(...xs))],
        range: [0, innerWidth],
      }),
      yScale: scaleLinear({
        domain: [minY - pad, maxY + pad],
        range: [innerHeight, 0],
        nice: false,
      }),
    };
  }, [points, baseline, innerWidth, innerHeight]);

  const stroke =
    trend === "up"
      ? "var(--color-positive)"
      : trend === "down"
        ? "var(--color-negative)"
        : "var(--color-accent-soft)";

  const gradientId = `area-${trend}`;

  const onMove = useCallback(
    (event: React.MouseEvent<SVGRectElement> | React.TouchEvent<SVGRectElement>) => {
      const coords = localPoint(event);
      if (!coords || points.length === 0) return;
      const t = xScale.invert(coords.x - MARGIN.left).getTime();
      setHover(nearestIndex(points, t));
    },
    [points, xScale],
  );

  if (points.length < 2 || innerWidth <= 0 || innerHeight <= 0) return null;

  const spanDays = (points.at(-1)!.t - points[0].t) / 864e5;
  const formatTick = (t: number) => {
    const d = new Date(t);
    if (intraday) {
      return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
    // Au-delà d'un an, le jour n'apporte rien et l'année devient indispensable.
    if (spanDays > 400) {
      return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
    }
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  const active = hover != null ? points[hover] : null;
  const activeX = active ? xScale(new Date(active.t)) : 0;
  const activeY = active ? yScale(active.v) : 0;

  // Trois repères temporels suffisent : début, milieu, fin. Sur une série très
  // courte, ces trois positions retombent sur le même point : on déduplique
  // pour ne pas empiler deux libellés identiques.
  const ticks = [
    ...new Map(
      [points[0], points[Math.floor(points.length / 2)], points.at(-1)!].map(
        (p) => [p.t, p],
      ),
    ).values(),
  ];

  // Le libellé de la valeur survolée doit rester dans le cadre.
  const labelWidth = 148;
  const labelX = Math.min(
    Math.max(activeX + MARGIN.left - labelWidth / 2, 4),
    width - labelWidth - 4,
  );

  return (
    <div className="relative">
      <svg ref={svgRef} width={width} height={height} className="overflow-visible">
        <LinearGradient id={gradientId} from={stroke} to={stroke} fromOpacity={0.22} toOpacity={0} />

        <Group left={MARGIN.left} top={MARGIN.top}>
          {baseline != null && (
            <line
              x1={0}
              x2={innerWidth}
              y1={yScale(baseline)}
              y2={yScale(baseline)}
              stroke="var(--color-hairline-strong)"
              strokeDasharray="2 4"
              strokeWidth={1}
            />
          )}

          <AreaClosed<SeriesPoint>
            data={points}
            x={(d) => xScale(new Date(d.t))}
            y={(d) => yScale(d.v)}
            yScale={yScale}
            curve={curveMonotoneX}
            fill={`url(#${gradientId})`}
          />

          <LinePath<SeriesPoint>
            data={points}
            x={(d) => xScale(new Date(d.t))}
            y={(d) => yScale(d.v)}
            curve={curveMonotoneX}
            stroke={stroke}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {active && (
            <g pointerEvents="none">
              <line
                x1={activeX}
                x2={activeX}
                y1={0}
                y2={innerHeight}
                stroke="var(--color-hairline-strong)"
                strokeWidth={1}
              />
              <circle cx={activeX} cy={activeY} r={7} fill={stroke} opacity={0.16} />
              <circle
                cx={activeX}
                cy={activeY}
                r={3.5}
                fill={stroke}
                stroke="var(--color-canvas)"
                strokeWidth={2}
              />
            </g>
          )}

          <rect
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onTouchStart={onMove}
            onTouchMove={onMove}
            onTouchEnd={() => setHover(null)}
          />
        </Group>

        <Group left={MARGIN.left} top={MARGIN.top + innerHeight + 16}>
          {ticks.map((p, i) => {
            const isFirst = i === 0;
            const isLast = i === ticks.length - 1;
            return (
            <text
              key={p.t}
              x={isFirst ? 0 : isLast ? innerWidth : xScale(new Date(p.t))}
              textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
              className="fill-ink-faint text-[11px] tnum"
            >
              {formatTick(p.t)}
            </text>
            );
          })}
        </Group>
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-hairline bg-surface-2/95 px-2.5 py-1.5 shadow-popover backdrop-blur-sm"
          style={{ left: labelX, width: labelWidth }}
        >
          <div className="tnum text-sm font-semibold text-ink">
            <Montant>{formatCurrency(active.v)}</Montant>
          </div>
          <div className="tnum text-[11px] text-ink-faint">
            {intraday ? formatDateTime(active.t) : formatDate(active.t)}
          </div>
        </div>
      )}
    </div>
  );
}

export function PortfolioChart({ className, ...props }: Props) {
  if (props.points.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-ink-faint",
          className,
        )}
      >
        Pas encore assez de données pour tracer une courbe.
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <ParentSize debounceTime={16}>
        {({ width, height }) =>
          width > 0 && height > 0 ? (
            <Chart width={width} height={height} {...props} />
          ) : null
        }
      </ParentSize>
    </div>
  );
}
