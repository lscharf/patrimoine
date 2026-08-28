"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { curveMonotoneX } from "@visx/curve";
import { LinearGradient } from "@visx/gradient";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { AreaClosed, LinePath } from "@visx/shape";
import { scaleLinear, scaleTime } from "@visx/scale";
import { localPoint } from "@visx/event";
import { Montant } from "@/components/privacy/amount";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SeriesPoint } from "@/server/portfolio/types";

const MARGIN = { top: 20, right: 12, bottom: 28, left: 12 };
const Y_PADDING = 0.08;

type Props = {
  points: SeriesPoint[];
  initialAmount?: number;
  className?: string;
};

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

function AmortizationChartInner({
  width,
  height,
  points,
  initialAmount,
}: Props & { width: number; height: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [nowEpoch] = useState(() => Date.now());
  const svgRef = useRef<SVGSVGElement>(null);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const { xScale, yScale } = useMemo(() => {
    const xs = points.map((p) => p.t);
    const ys = points.map((p) => p.v);
    if (initialAmount != null) ys.push(initialAmount);

    const max = Math.max(...ys, 1);
    const pad = max * Y_PADDING;

    return {
      xScale: scaleTime({
        domain: [new Date(Math.min(...xs)), new Date(Math.max(...xs))],
        range: [0, innerWidth],
      }),
      yScale: scaleLinear({
        domain: [0, max + pad],
        range: [innerHeight, 0],
        nice: false,
      }),
    };
  }, [points, initialAmount, innerWidth, innerHeight]);

  const onMove = useCallback(
    (event: React.MouseEvent<SVGRectElement> | React.TouchEvent<SVGRectElement>) => {
      const coords = localPoint(event);
      if (!coords || points.length === 0) return;
      const t = xScale.invert(coords.x - MARGIN.left).getTime();
      setHover(nearestIndex(points, t));
    },
    [points, xScale],
  );

  if (points.length < 2 || innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  const active = hover != null ? points[hover] : null;
  const activeX = active ? xScale(new Date(active.t)) : 0;
  const activeY = active ? yScale(active.v) : 0;

  // Ligne de repère aujourd'hui
  const isNowInRange =
    nowEpoch >= points[0].t && nowEpoch <= points[points.length - 1].t;
  const nowX = isNowInRange ? xScale(new Date(nowEpoch)) : null;

  // Repères temporels (début, milieu, fin)
  const ticks = [
    points[0],
    points[Math.floor(points.length / 2)],
    points[points.length - 1],
  ];

  const strokeColor = "#e5a93c"; // Couleur dorée / ambrée élégante comme Finary
  const gradientId = "amortization-area-grad";

  const totalCap = initialAmount ?? points[0]?.v ?? 1;

  const tooltipWidth = 160;
  const tooltipX = Math.min(
    Math.max(activeX + MARGIN.left - tooltipWidth / 2, 4),
    width - tooltipWidth - 4,
  );

  return (
    <div className="relative">
      <svg ref={svgRef} width={width} height={height} className="overflow-visible">
        <LinearGradient
          id={gradientId}
          from={strokeColor}
          to={strokeColor}
          fromOpacity={0.25}
          toOpacity={0.01}
        />

        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* Ligne 0 € */}
          <line
            x1={0}
            x2={innerWidth}
            y1={yScale(0)}
            y2={yScale(0)}
            stroke="var(--color-hairline)"
            strokeWidth={1}
          />

          {/* Ligne repère "Aujourd'hui" */}
          {nowX != null && (
            <line
              x1={nowX}
              x2={nowX}
              y1={0}
              y2={innerHeight}
              stroke="var(--color-hairline-strong)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}

          {/* Remplissage de l'aire sous la courbe */}
          <AreaClosed<SeriesPoint>
            data={points}
            x={(d) => xScale(new Date(d.t))}
            y={(d) => yScale(d.v)}
            yScale={yScale}
            curve={curveMonotoneX}
            fill={`url(#${gradientId})`}
          />

          {/* Tracé de la courbe */}
          <LinePath<SeriesPoint>
            data={points}
            x={(d) => xScale(new Date(d.t))}
            y={(d) => yScale(d.v)}
            curve={curveMonotoneX}
            stroke={strokeColor}
            strokeWidth={2}
          />

          {/* Curseur et réticule au survol */}
          {active && (
            <>
              <line
                x1={activeX}
                x2={activeX}
                y1={0}
                y2={innerHeight}
                stroke="var(--color-ink-muted)"
                strokeDasharray="2 3"
                strokeWidth={1}
              />
              <circle
                cx={activeX}
                cy={activeY}
                r={4.5}
                fill={strokeColor}
                stroke="var(--color-canvas)"
                strokeWidth={2}
              />
            </>
          )}

          {/* Ticks temporels sur l'axe X */}
          {ticks.map((tick, i) => {
            const x = xScale(new Date(tick.t));
            const align = i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle";
            const dateStr = new Date(tick.t).toLocaleDateString("fr-FR", {
              month: "short",
              year: "numeric",
            });
            return (
              <text
                key={tick.t}
                x={x}
                y={innerHeight + 18}
                textAnchor={align}
                className="fill-ink-faint text-[11px] select-none"
              >
                {dateStr}
              </text>
            );
          })}

          {/* Zone interactive de capture des événements souris / tactile */}
          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={onMove}
            onTouchMove={onMove}
            onMouseLeave={() => setHover(null)}
            onTouchEnd={() => setHover(null)}
          />
        </Group>
      </svg>

      {/* Tooltip flottant au survol */}
      {active && (
        <div
          className="pointer-events-none absolute top-1 rounded-md border border-hairline bg-surface/95 px-2.5 py-1.5 shadow-lg backdrop-blur text-xs"
          style={{ left: tooltipX, width: tooltipWidth }}
        >
          <p className="font-medium text-ink-muted">
            {new Date(active.t).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-ink-faint">Restant :</span>
            <span className="tnum font-semibold text-ink">
              <Montant>{formatCurrency(active.v)}</Montant>
            </span>
          </div>
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-ink-faint">Remboursé :</span>
            <span className="tnum text-positive">
              <Montant>{formatCurrency(Math.max(0, totalCap - active.v))}</Montant>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function AmortizationChart({ className, ...props }: Props) {
  return (
    <div className={cn("h-full w-full min-w-0 select-none", className)}>
      <ParentSize debounceTime={10}>
        {({ width, height }) =>
          width > 0 && height > 0 ? (
            <AmortizationChartInner width={width} height={height} {...props} />
          ) : null
        }
      </ParentSize>
    </div>
  );
}
