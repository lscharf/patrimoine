"use client";

import * as React from "react";
import { Loader2, Search, X } from "lucide-react";

import { Badge, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { searchInstruments } from "@/server/actions";
import type { SearchHit } from "@/server/prices/provider";

/* -------------------------------------------------------------------------- */
/* Libellés de type                                                            */
/* -------------------------------------------------------------------------- */

const TYPE_LABELS: Record<string, string> = {
  ETF: "ETF",
  EQUITY: "Action",
  CRYPTOCURRENCY: "Crypto",
  MUTUALFUND: "Fonds",
  INDEX: "Indice",
  CURRENCY: "Devise",
  FUTURE: "Future",
  OPTION: "Option",
};

/** `EQUITY` → « Action ». Un type inconnu est renvoyé tel quel. */
export function instrumentTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return TYPE_LABELS[type.toUpperCase()] ?? type;
}

/* -------------------------------------------------------------------------- */
/* Composant                                                                   */
/* -------------------------------------------------------------------------- */

export interface InstrumentSearchProps {
  /** Instrument déjà choisi — affiché sous forme de puce supprimable. */
  value?: SearchHit | null;
  /** Appelé quand l'utilisateur choisit une ligne de résultat. */
  onSelect: (hit: SearchHit) => void;
  /** Appelé quand l'utilisateur retire l'instrument choisi. */
  onClear?: () => void;
  /** Identifiant du champ, pour l'association avec le `<Label>`. */
  id?: string;
  /** Libellé affiché au-dessus du champ. */
  label?: string;
  /** Message d'erreur affiché sous le champ. */
  error?: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

const HELPER_TEXT =
  "Recherchez par nom ou saisissez un ticker (CW8.PA, BTC-EUR, AAPL).";

export function InstrumentSearch({
  value = null,
  onSelect,
  onClear,
  id,
  label = "Instrument",
  error,
  placeholder = "ETF World, AAPL, BTC-EUR…",
  autoFocus = false,
  disabled = false,
  className,
}: InstrumentSearchProps) {
  const reactId = React.useId();
  const fieldId = id ?? `instrument-${reactId}`;
  const listId = `${fieldId}-list`;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;

  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [pending, setPending] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  /** Vrai dès qu'une recherche a abouti pour la saisie courante. */
  const [searched, setSearched] = React.useState(false);

  const listRef = React.useRef<HTMLUListElement>(null);
  /** Numéro de la dernière requête émise — ignore les réponses obsolètes. */
  const seq = React.useRef(0);

  /* --- Recherche débouncée ------------------------------------------------ */

  React.useEffect(() => {
    const q = query.trim();
    // Le retour à l'état vide est fait par `handleChange` : rien à faire ici.
    if (q.length < 2) return;

    const ticket = (seq.current += 1);
    const timer = window.setTimeout(async () => {
      try {
        const result = await searchInstruments(q);
        if (ticket !== seq.current) return;
        if (result.ok) {
          setHits(result.data);
          setSearchError(null);
        } else {
          setHits([]);
          setSearchError(result.error);
        }
      } catch {
        if (ticket !== seq.current) return;
        setHits([]);
        setSearchError("La recherche a échoué. Réessayez.");
      } finally {
        if (ticket === seq.current) {
          setPending(false);
          setSearched(true);
        }
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  /* --- L'option active reste visible -------------------------------------- */

  React.useEffect(() => {
    if (!open || active < 0) return;
    const node = listRef.current?.children[active] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  /* --- Sélection ----------------------------------------------------------- */

  /** Saisie : remet l'état à zéro sous 2 caractères, arme le spinner au-delà. */
  function handleChange(next: string) {
    setQuery(next);
    setOpen(true);
    setActive(-1);

    if (next.trim().length < 2) {
      seq.current += 1;
      setHits([]);
      setPending(false);
      setSearchError(null);
      setSearched(false);
    } else {
      setPending(true);
      setSearchError(null);
    }
  }

  const choose = React.useCallback(
    (hit: SearchHit) => {
      onSelect(hit);
      seq.current += 1;
      setQuery("");
      setHits([]);
      setOpen(false);
      setActive(-1);
      setSearched(false);
    },
    [onSelect],
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (hits.length === 0 ? -1 : Math.min(i + 1, hits.length - 1)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? 0 : i - 1));
      return;
    }
    if (event.key === "Enter") {
      if (open && active >= 0 && hits[active]) {
        // Ne pas soumettre le formulaire qui contient la combobox.
        event.preventDefault();
        choose(hits[active]);
      }
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        // La liste se ferme avant la boîte de dialogue parente.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        setActive(-1);
      }
      return;
    }
    if (event.key === "Tab" && open) {
      setOpen(false);
      setActive(-1);
    }
  }

  /* --- Instrument choisi : puce supprimable -------------------------------- */

  if (value) {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <Label htmlFor={`${fieldId}-chip`} required>
          {label}
        </Label>
        <div
          className={cn(
            "bg-surface-2 border-hairline flex items-center gap-3 rounded-xl border px-3 py-2",
          )}
        >
          <span className="tnum text-ink text-sm font-semibold">{value.symbol}</span>
          <span className="text-ink-muted min-w-0 flex-1 truncate text-[13px]">
            {value.name}
          </span>
          <Badge variant="neutral">{instrumentTypeLabel(value.type)}</Badge>
          <button
            id={`${fieldId}-chip`}
            type="button"
            onClick={() => onClear?.()}
            disabled={disabled}
            className={cn(
              "text-ink-faint hover:bg-surface-3 hover:text-ink inline-flex size-7 shrink-0",
              "items-center justify-center rounded-lg transition-colors duration-150",
              "focus-visible:ring-accent/70 focus-visible:ring-offset-surface outline-none",
              "focus-visible:ring-2 focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-45",
            )}
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Retirer {value.symbol}</span>
          </button>
        </div>
        {error ? (
          <p id={errorId} className="text-negative text-xs">
            {error}
          </p>
        ) : (
          <p className="text-ink-faint text-xs">
            {/* La recherche ne renvoie pas toujours la devise : elle est
                résolue côté serveur à la création de la ligne. */}
            {value.currency
              ? `Devise de cotation : ${value.currency}`
              : "La devise de cotation sera détectée automatiquement."}
          </p>
        )}
      </div>
    );
  }

  /* --- Champ de recherche --------------------------------------------------- */

  const showEmpty =
    open && !pending && !searchError && searched && hits.length === 0;
  const showList = open && !searchError && hits.length > 0;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={fieldId} required>
        {label}
      </Label>

      <div className="relative">
        <Search
          className="text-ink-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          id={fieldId}
          type="text"
          role="combobox"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          aria-activedescendant={
            showList && active >= 0 ? `${fieldId}-opt-${active}` : undefined
          }
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "peer bg-surface-2 text-ink border-hairline flex h-10 w-full rounded-xl border",
            "py-2 pr-9 pl-9 text-sm",
            "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
            "placeholder:text-ink-faint",
            "hover:border-hairline-strong",
            "focus-visible:border-accent/60 focus-visible:ring-accent/35 outline-none focus-visible:ring-2",
            "disabled:cursor-not-allowed disabled:opacity-45",
            "aria-invalid:border-negative/60",
          )}
        />
        {pending ? (
          <Loader2
            className="text-ink-faint absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        <span className="sr-only" role="status" aria-live="polite">
          {pending ? "Recherche en cours" : null}
        </span>

        {showList ? (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Résultats de la recherche"
            className={cn(
              "bg-surface-2 border-hairline-strong shadow-popover absolute z-50 mt-1.5",
              "max-h-64 w-full overflow-y-auto rounded-xl border p-1",
            )}
          >
            {hits.map((hit, index) => (
              <li
                key={`${hit.symbol}-${index}`}
                id={`${fieldId}-opt-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(hit)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2",
                  index === active && "bg-surface-3",
                )}
              >
                <span className="tnum text-ink shrink-0 text-sm font-semibold">
                  {hit.symbol}
                </span>
                <span className="text-ink-muted min-w-0 flex-1 truncate text-[13px]">
                  {hit.name}
                </span>
                {hit.exchange ? (
                  <span className="text-ink-faint shrink-0 text-[11px]">
                    {hit.exchange}
                  </span>
                ) : null}
                <Badge variant="neutral">{instrumentTypeLabel(hit.type)}</Badge>
              </li>
            ))}
          </ul>
        ) : null}

        {showEmpty ? (
          <div
            className={cn(
              "bg-surface-2 border-hairline-strong shadow-popover absolute z-50 mt-1.5",
              "text-ink-muted w-full rounded-xl border px-3 py-3 text-[13px]",
            )}
          >
            Aucun résultat
          </div>
        ) : null}

        {open && searchError ? (
          <div
            className={cn(
              "bg-surface-2 border-hairline-strong shadow-popover absolute z-50 mt-1.5",
              "text-negative w-full rounded-xl border px-3 py-3 text-[13px]",
            )}
          >
            {searchError}
          </div>
        ) : null}
      </div>

      <p id={helpId} className="text-ink-faint text-xs">
        {HELPER_TEXT}
      </p>
      {error ? (
        <p id={errorId} className="text-negative text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
