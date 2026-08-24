/**
 * Formatage fr-FR — helpers purs, sans dépendance, basés sur `Intl`.
 *
 * Toute valeur non finie (`NaN`, `Infinity`, `null`, `undefined`) est rendue
 * sous la forme d'un cadratin « — » afin de ne jamais afficher « NaN € ».
 */

const LOCALE = "fr-FR";

/** Cadratin utilisé comme valeur de repli. */
export const EM_DASH = "—";

/** Signe moins typographique (U+2212), et non le trait d'union U+002D. */
export const MINUS_SIGN = "−";

/** Signe plus. */
export const PLUS_SIGN = "+";

type Maybe = number | null | undefined;

function isFinite_(value: Maybe): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Remplace le trait d'union ASCII produit par `Intl` par le vrai signe moins
 * typographique, afin que tous les nombres de l'application soient cohérents.
 */
function withTypographicMinus(formatted: string): string {
  return formatted.replace(/-/g, MINUS_SIGN);
}

/* -------------------------------------------------------------------------- */
/* Devises                                                                     */
/* -------------------------------------------------------------------------- */

export interface CurrencyOptions {
  /** Notation compacte : `27,9 k€` au lieu de `27 904 €`. */
  compact?: boolean;
  /** Nombre de décimales (ignoré en notation compacte). Par défaut `0`. */
  decimals?: number;
}

/**
 * Recompose une valeur formatée en supprimant l'espace inséré par ICU entre
 * le suffixe compact (`k`, `M`, `Md`) et le symbole monétaire :
 * `27,9 k €` devient `27,9 k€`.
 */
function joinCompactCurrency(parts: Intl.NumberFormatPart[]): string {
  let out = "";
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const isSpacer =
      part.type === "literal" && part.value.trim() === "" && i > 0 && i < parts.length - 1;
    if (isSpacer) {
      const before = parts[i - 1].type;
      const after = parts[i + 1].type;
      const touchesCompact = before === "compact" || after === "compact";
      const touchesCurrency = before === "currency" || after === "currency";
      if (touchesCompact && touchesCurrency) continue;
    }
    out += part.value;
  }
  return out;
}

/**
 * `formatCurrency(27904)` → `"27 904 €"`
 * `formatCurrency(27904, "EUR", { compact: true })` → `"27,9 k€"`
 */
export function formatCurrency(
  value: Maybe,
  currency: string = "EUR",
  opts: CurrencyOptions = {},
): string {
  if (!isFinite_(value)) return EM_DASH;

  const { compact = false, decimals } = opts;

  if (compact) {
    const formatter = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.abs(value) < 1000 ? (decimals ?? 0) : 1,
    });
    return withTypographicMinus(joinCompactCurrency(formatter.formatToParts(value)));
  }

  const fractionDigits = decimals ?? 0;
  return withTypographicMinus(
    new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value),
  );
}

/**
 * Comme {@link formatCurrency}, mais porte toujours un signe explicite.
 * `formatSignedCurrency(1240)` → `"+1 240 €"`
 * `formatSignedCurrency(-1240)` → `"−1 240 €"`
 */
/**
 * Prix unitaire — la précision s'adapte à l'ordre de grandeur.
 *
 * `formatCurrency` arrondit à l'unité, ce qui convient à un total de
 * portefeuille mais escamote les centimes d'un cours : `98,45 €` deviendrait
 * `98 €`. À l'autre extrême, un jeton crypto à 0,0042 € doit conserver ses
 * décimales significatives.
 */
export function formatPrice(value: Maybe, currency: string = "EUR"): string {
  if (!isFinite_(value)) return EM_DASH;
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return formatCurrency(value, currency, { decimals });
}

export function formatSignedCurrency(
  value: Maybe,
  currency: string = "EUR",
  opts: CurrencyOptions = {},
): string {
  if (!isFinite_(value)) return EM_DASH;
  const body = formatCurrency(Math.abs(value), currency, opts);
  if (body === EM_DASH) return EM_DASH;
  const sign = value < 0 ? MINUS_SIGN : PLUS_SIGN;
  return `${sign}${body}`;
}

/* -------------------------------------------------------------------------- */
/* Pourcentages                                                                */
/* -------------------------------------------------------------------------- */

export interface PercentOptions {
  /** Force l'affichage du signe (`+` / `−`). */
  signed?: boolean;
  /** Nombre de décimales. Par défaut `2`. */
  decimals?: number;
}

/**
 * L'entrée est un ratio, pas une valeur déjà multipliée par cent.
 * `formatPercent(0.1064)` → `"10,64 %"`
 * `formatPercent(-0.1064, { signed: true })` → `"−10,64 %"`
 */
export function formatPercent(value: Maybe, opts: PercentOptions = {}): string {
  if (!isFinite_(value)) return EM_DASH;

  const { signed = false, decimals = 2 } = opts;
  const magnitude = signed ? Math.abs(value) : value;

  const body = withTypographicMinus(
    new Intl.NumberFormat(LOCALE, {
      style: "percent",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(magnitude),
  );

  if (!signed) return body;
  return `${value < 0 ? MINUS_SIGN : PLUS_SIGN}${body}`;
}

/* -------------------------------------------------------------------------- */
/* Quantités                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Quantités « crypto-friendly » : jusqu'à 8 décimales, zéros de fin retirés.
 * `formatQuantity(0.00042)` → `"0,00042"`
 * `formatQuantity(1.5)` → `"1,5"`
 */
export function formatQuantity(value: Maybe): string {
  if (!isFinite_(value)) return EM_DASH;
  return withTypographicMinus(
    new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    }).format(value),
  );
}

/* -------------------------------------------------------------------------- */
/* Nombres compacts                                                            */
/* -------------------------------------------------------------------------- */

/** `formatCompactNumber(27904)` → `"27,9 k"` */
export function formatCompactNumber(value: Maybe): string {
  if (!isFinite_(value)) return EM_DASH;
  return withTypographicMinus(
    new Intl.NumberFormat(LOCALE, {
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.abs(value) < 1000 ? 0 : 1,
    }).format(value),
  );
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toDate(iso: string | number | Date | null | undefined): Date | null {
  if (iso === null || iso === undefined || iso === "") return null;
  const date = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Les chaînes « date seule » (`2026-08-24`) sont interprétées en UTC pour
 * éviter tout décalage d'un jour selon le fuseau du navigateur.
 */
function zoneFor(iso: string | number | Date | null | undefined): string | undefined {
  return typeof iso === "string" && DATE_ONLY.test(iso) ? "UTC" : undefined;
}

/** `formatDate("2026-08-24")` → `"24 août 2026"` */
export function formatDate(iso: string | number | Date | null | undefined): string {
  const date = toDate(iso);
  if (!date) return EM_DASH;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: zoneFor(iso),
  }).format(date);
}

/** `formatDateShort("2026-08-24")` → `"24 août"` */
export function formatDateShort(iso: string | number | Date | null | undefined): string {
  const date = toDate(iso);
  if (!date) return EM_DASH;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "long",
    timeZone: zoneFor(iso),
  }).format(date);
}

/** `formatDateTime("2026-08-24T18:05:00Z")` → `"24 août 2026, 20:05"` */
export function formatDateTime(iso: string | number | Date | null | undefined): string {
  const date = toDate(iso);
  if (!date) return EM_DASH;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
