import Link from "next/link";
import { RefreshButton } from "@/components/refresh-button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Patrimoine" },
  { href: "/comptes", label: "Comptes" },
  { href: "/transactions", label: "Transactions" },
];

export function SiteHeader({ active = "/" }: { active?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span
            className="size-5 rounded-md bg-gradient-to-br from-accent to-accent-soft"
            aria-hidden
          />
          <span className="text-sm font-semibold tracking-tight text-ink">
            Patrimoine
          </span>
        </Link>

        <nav
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none"
          aria-label="Navigation principale"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                active === item.href
                  ? "text-ink"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="shrink-0">
          <RefreshButton />
        </div>
      </div>
    </header>
  );
}
