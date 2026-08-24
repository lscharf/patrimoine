import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { instruments, manualValues } from "@/db/schema";
import type { Transaction } from "@/db/schema";
import {
  ensureDailyHistory,
  ensureFxHistory,
  intraday,
  lastCloseBefore,
  readBars,
  readFxBars,
  today,
} from "@/server/prices/cache";
import { isoDate, parseIso } from "@/server/prices/provider";
import { netFlowsBetween, quantityTimeline } from "./cost-basis";
import {
  loadPortfolio,
  makeFxOn,
  prepareFx,
  type LoadedHolding,
} from "./snapshot";
import type { HistorySeries, Range, SeriesPoint } from "./types";

/** Au-delà, la courbe est rééchantillonnée : l'écran n'a pas plus de pixels. */
const MAX_POINTS = 420;

/* ------------------------------------------------------------------ *
 * Fenêtre temporelle
 * ------------------------------------------------------------------ */

function windowStart(range: Range, earliest: string): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case "1J":
      d.setDate(d.getDate() - 1);
      break;
    case "7J":
      d.setDate(d.getDate() - 7);
      break;
    case "1M":
      d.setMonth(d.getMonth() - 1);
      break;
    case "3M":
      d.setMonth(d.getMonth() - 3);
      break;
    case "6M":
      d.setMonth(d.getMonth() - 6);
      break;
    case "YTD":
      d.setMonth(0, 1);
      break;
    case "1A":
      d.setFullYear(d.getFullYear() - 1);
      break;
    case "TOUT":
      return earliest;
  }
  // Inutile de remonter avant la première transaction : la courbe serait plate à zéro.
  const iso = isoDate(d);
  return iso < earliest ? earliest : iso;
}

/** Toutes les dates calendaires de `from` à `to`, incluses. */
function dateGrid(from: string, to: string): string[] {
  const out: string[] = [];
  const end = parseIso(to);
  for (const d = parseIso(from); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(isoDate(d));
  }
  return out;
}

/**
 * Projette des barres datées sur la grille en reportant la dernière valeur
 * connue — les week-ends et jours fériés n'ont pas de cotation.
 */
function forwardFill(
  grid: string[],
  bars: { date: string; close: number }[],
  seed: number | null,
): Float64Array {
  const out = new Float64Array(grid.length);
  let carried = seed ?? (bars[0]?.close ?? 0);
  let i = 0;
  for (let g = 0; g < grid.length; g++) {
    while (i < bars.length && bars[i].date <= grid[g]) {
      carried = bars[i].close;
      i++;
    }
    out[g] = carried;
  }
  return out;
}

/**
 * Valeur d'une ligne non cotée sur la grille : les valorisations saisies font
 * foi, et tant qu'aucune n'a été renseignée on retient les versements cumulés.
 */
function manualTimeline(
  holdingId: number,
  txs: Transaction[],
  grid: string[],
): Float64Array {
  const valuations = db
    .select({ date: manualValues.date, value: manualValues.value })
    .from(manualValues)
    .where(eq(manualValues.holdingId, holdingId))
    .orderBy(manualValues.date)
    .all();

  const deposits = [...txs]
    .filter((t) => t.type === "DEPOSIT" || t.type === "WITHDRAWAL")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  const out = new Float64Array(grid.length);
  let vi = 0;
  let di = 0;
  let cumulative = 0;
  let lastValuation: number | null = null;
  let lastValuationDate: string | null = null;
  let depositsSinceValuation = 0;

  for (let g = 0; g < grid.length; g++) {
    while (di < deposits.length && deposits[di].date <= grid[g]) {
      const amount =
        deposits[di].type === "DEPOSIT"
          ? deposits[di].amount
          : -deposits[di].amount;
      cumulative += amount;
      if (lastValuationDate && deposits[di].date > lastValuationDate) {
        depositsSinceValuation += amount;
      }
      di++;
    }
    while (vi < valuations.length && valuations[vi].date <= grid[g]) {
      lastValuation = valuations[vi].value;
      lastValuationDate = valuations[vi].date;
      depositsSinceValuation = 0;
      vi++;
    }
    // Après une valorisation, les versements ultérieurs s'y ajoutent tant
    // qu'aucune nouvelle valorisation n'a été saisie.
    out[g] =
      lastValuation != null ? lastValuation + depositsSinceValuation : cumulative;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Rééchantillonnage — Largest Triangle Three Buckets
 * ------------------------------------------------------------------ */

/**
 * Réduit la courbe à `threshold` points en conservant sa silhouette :
 * les pics et creux survivent là où un simple échantillonnage les gommerait.
 */
function lttb(points: SeriesPoint[], threshold: number): SeriesPoint[] {
  if (threshold >= points.length || threshold < 3) return points;

  const sampled: SeriesPoint[] = [points[0]];
  const every = (points.length - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * every) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * every) + 1, points.length);

    // Barycentre du seau suivant : sommet mobile du triangle.
    let avgT = 0;
    let avgV = 0;
    const avgCount = rangeEnd - rangeStart || 1;
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgT += points[j].t;
      avgV += points[j].v;
    }
    avgT /= avgCount;
    avgV /= avgCount;

    const bucketStart = Math.floor(i * every) + 1;
    const bucketEnd = Math.floor((i + 1) * every) + 1;
    const pa = points[a];

    let best = bucketStart;
    let bestArea = -1;
    for (let j = bucketStart; j < Math.min(bucketEnd, points.length); j++) {
      const area = Math.abs(
        (pa.t - avgT) * (points[j].v - pa.v) -
          (pa.t - points[j].t) * (avgV - pa.v),
      );
      if (area > bestArea) {
        bestArea = area;
        best = j;
      }
    }
    sampled.push(points[best]);
    a = best;
  }

  sampled.push(points[points.length - 1]);
  return sampled;
}

/* ------------------------------------------------------------------ *
 * Courbe journalière
 * ------------------------------------------------------------------ */

async function buildDailySeries(
  range: Range,
  scoped: LoadedHolding[],
  earliest: string,
  liveTotal: number,
): Promise<HistorySeries> {
  const from = windowStart(range, earliest);
  const to = today();
  const grid = dateGrid(from, to);

  const spot = await prepareFx(scoped);

  // Un seul aller-retour réseau par instrument, en parallèle.
  const usedInstruments = new Map(
    scoped
      .filter((h) => h.kind === "QUOTED" && h.instrument)
      .map((h) => [h.instrument!.id, h.instrument!]),
  );
  await Promise.all([
    ...[...usedInstruments.values()].map((i) => ensureDailyHistory(i, from)),
    ...[...new Set(scoped.map((h) => h.currency.toUpperCase()))]
      .filter((c) => c !== "EUR")
      .map((c) => ensureFxHistory(c, from)),
  ]);

  // Les cours ont pu être complétés : relire pour prendre les barres fraîches.
  const refreshed = new Map(
    db
      .select()
      .from(instruments)
      .all()
      .map((i) => [i.id, i]),
  );

  const priceSeries = new Map<number, Float64Array>();
  for (const id of usedInstruments.keys()) {
    priceSeries.set(
      id,
      forwardFill(grid, readBars(id, from), lastCloseBefore(id, from)),
    );
  }

  const fxSeries = new Map<string, Float64Array>();
  for (const cur of new Set(scoped.map((h) => h.currency.toUpperCase()))) {
    if (cur === "EUR") continue;
    const bars = readFxBars(cur, from);
    fxSeries.set(cur, forwardFill(grid, bars, bars[0]?.close ?? spot.get(cur) ?? 1));
  }

  const totals = new Float64Array(grid.length);
  for (const h of scoped) {
    const cur = h.currency.toUpperCase();
    const fx = fxSeries.get(cur);

    if (h.kind === "QUOTED" && h.instrument) {
      const prices = priceSeries.get(h.instrument.id);
      if (!prices) continue;
      const qty = quantityTimeline(h.txs, grid);
      for (let g = 0; g < grid.length; g++) {
        totals[g] += qty[g] * prices[g] * (fx ? fx[g] : 1);
      }
    } else {
      const values = manualTimeline(h.id, h.txs, grid);
      for (let g = 0; g < grid.length; g++) {
        totals[g] += values[g] * (fx ? fx[g] : 1);
      }
    }
  }

  // Le dernier point doit refléter le cours live, pas la clôture de la veille.
  if (totals.length > 0 && liveTotal > 0) totals[totals.length - 1] = liveTotal;
  void refreshed;

  const points: SeriesPoint[] = grid.map((d, i) => ({
    t: parseIso(d).getTime(),
    v: totals[i],
  }));

  const fxOnFor = (h: LoadedHolding) =>
    makeFxOn(h.currency, spot.get(h.currency.toUpperCase()) ?? 1);
  const netFlows = scoped.reduce(
    (sum, h) => sum + netFlowsBetween(h.txs, from, to, fxOnFor(h)),
    0,
  );

  const startValue = points[0]?.v ?? 0;
  const endValue = points.at(-1)?.v ?? 0;
  const change = endValue - startValue - netFlows;
  const base = startValue + Math.max(netFlows, 0);

  return {
    range,
    points: lttb(points, MAX_POINTS),
    startValue,
    endValue,
    netFlows,
    change,
    changePct: base > 0 ? change / base : null,
    isIntraday: false,
  };
}

/* ------------------------------------------------------------------ *
 * Courbe intrajournalière (1J et 7J)
 * ------------------------------------------------------------------ */

/**
 * Fenêtres traitées en intraday. Sur une journée ou une semaine, une barre
 * quotidienne donnerait une courbe en escalier de quelques points ; il faut
 * descendre sous la journée pour que le graphique ait du sens.
 *
 * La fenêtre est **glissante** et non calée sur minuit : les places de marché
 * ferment à des heures différentes et le crypto cote en continu, si bien qu'un
 * découpage par jour calendaire laisse la courbe quasi vide en soirée.
 */
const INTRADAY_WINDOWS = {
  "1J": { lookbackMs: 24 * 3600_000, interval: "5m" as const, fetchDays: 3 },
  "7J": { lookbackMs: 7 * 864e5, interval: "1h" as const, fetchDays: 10 },
};

type IntradayRange = keyof typeof INTRADAY_WINDOWS;

export function isIntradayRange(range: Range): range is IntradayRange {
  return range in INTRADAY_WINDOWS;
}

function emptySeries(range: Range, liveTotal: number): HistorySeries {
  return {
    range,
    points: [],
    startValue: liveTotal,
    endValue: liveTotal,
    netFlows: 0,
    change: 0,
    changePct: null,
    isIntraday: true,
  };
}

async function buildIntradaySeries(
  range: IntradayRange,
  scoped: LoadedHolding[],
  liveTotal: number,
): Promise<HistorySeries> {
  const { lookbackMs, interval, fetchDays } = INTRADAY_WINDOWS[range];
  const spot = await prepareFx(scoped);

  const quotedInstruments = new Map(
    scoped
      .filter((h) => h.kind === "QUOTED" && h.instrument)
      .map((h) => [h.instrument!.id, h.instrument!]),
  );

  const ticksByInstrument = new Map<number, { t: number; close: number }[]>();
  await Promise.all(
    [...quotedInstruments.values()].map(async (inst) => {
      ticksByInstrument.set(
        inst.id,
        await intraday(
          inst.symbol,
          new Date(Date.now() - fetchDays * 864e5),
          interval,
        ),
      );
    }),
  );

  let maxT = 0;
  for (const ticks of ticksByInstrument.values()) {
    const last = ticks.at(-1)?.t ?? 0;
    if (last > maxT) maxT = last;
  }
  if (maxT === 0) return emptySeries(range, liveTotal);

  const cutoff = maxT - lookbackMs;

  const timeline = [
    ...new Set(
      [...ticksByInstrument.values()].flatMap((ts) =>
        ts.filter((x) => x.t >= cutoff).map((x) => x.t),
      ),
    ),
  ].sort((a, b) => a - b);
  if (timeline.length === 0) return emptySeries(range, liveTotal);

  // La quantité détenue peut changer en cours de fenêtre (un achat en milieu
  // de semaine) : on la résout jour par jour, puis on indexe chaque tick sur
  // sa date locale.
  const gridDates = dateGrid(
    isoDate(new Date(cutoff)),
    isoDate(new Date(maxT)),
  );
  const dateIndex = new Map(gridDates.map((d, i) => [d, i]));
  const tickDateIdx = timeline.map(
    (t) => dateIndex.get(isoDate(new Date(t))) ?? gridDates.length - 1,
  );

  const totals = new Float64Array(timeline.length);

  for (const h of scoped) {
    const fx = spot.get(h.currency.toUpperCase()) ?? 1;
    const qtyByDate = quantityTimeline(h.txs, gridDates);

    if (h.kind === "QUOTED" && h.instrument) {
      const ticks = (ticksByInstrument.get(h.instrument.id) ?? []).filter(
        (x) => x.t >= cutoff,
      );
      // Avant la première cotation de la fenêtre, on part de la clôture connue.
      let carried =
        ticks[0]?.close ??
        h.instrument.prevClose ??
        h.instrument.lastPrice ??
        0;
      let i = 0;
      for (let g = 0; g < timeline.length; g++) {
        while (i < ticks.length && ticks[i].t <= timeline[g]) {
          carried = ticks[i].close;
          i++;
        }
        totals[g] += qtyByDate[tickDateIdx[g]] * carried * fx;
      }
    } else {
      // Une ligne non cotée ne bouge pas dans la journée : contribution plate,
      // mais elle suit tout de même les versements de la période.
      const values = manualTimeline(h.id, h.txs, gridDates);
      for (let g = 0; g < timeline.length; g++) {
        totals[g] += values[tickDateIdx[g]] * fx;
      }
    }
  }

  if (liveTotal > 0) totals[totals.length - 1] = liveTotal;

  const points: SeriesPoint[] = timeline.map((t, i) => ({ t, v: totals[i] }));
  const startValue = points[0].v;
  const endValue = points.at(-1)!.v;

  const fxOnFor = (h: LoadedHolding) =>
    makeFxOn(h.currency, spot.get(h.currency.toUpperCase()) ?? 1);
  const netFlows = scoped.reduce(
    (sum, h) =>
      sum +
      netFlowsBetween(
        h.txs,
        isoDate(new Date(cutoff)),
        isoDate(new Date(maxT)),
        fxOnFor(h),
      ),
    0,
  );

  const change = endValue - startValue - netFlows;
  const base = startValue + Math.max(netFlows, 0);

  return {
    range,
    points: lttb(points, MAX_POINTS),
    startValue,
    endValue,
    netFlows,
    change,
    changePct: base > 0 ? change / base : null,
    isIntraday: true,
  };
}

/* ------------------------------------------------------------------ *
 * Entrée publique
 * ------------------------------------------------------------------ */

export async function buildHistory(
  range: Range,
  opts: {
    userId: string;
    accountId?: number;
    holdingId?: number;
    liveTotal: number;
  },
): Promise<HistorySeries> {
  const { holdings: all } = loadPortfolio(opts.userId);

  const scoped = all.filter((h) => {
    if (opts.holdingId != null) return h.id === opts.holdingId;
    if (opts.accountId != null) return h.accountId === opts.accountId;
    return true;
  });

  let earliest: string | null = null;
  for (const h of scoped) {
    for (const tx of h.txs) if (!earliest || tx.date < earliest) earliest = tx.date;
  }

  if (!earliest || scoped.length === 0) {
    return {
      range,
      points: [],
      startValue: 0,
      endValue: 0,
      netFlows: 0,
      change: 0,
      changePct: null,
      isIntraday: isIntradayRange(range),
    };
  }

  return isIntradayRange(range)
    ? buildIntradaySeries(range, scoped, opts.liveTotal)
    : buildDailySeries(range, scoped, earliest, opts.liveTotal);
}
