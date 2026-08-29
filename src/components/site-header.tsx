import Link from "next/link";
import { RefreshButton } from "@/components/refresh-button";
import { UserMenu } from "@/components/auth/user-menu";
import { PrivacyToggle } from "@/components/privacy/privacy-toggle";
import { COOKIE_MASQUE } from "@/lib/privacy";
import { cookies } from "next/headers";
import { getSession } from "@/server/auth/session";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Patrimoine" },
  { href: "/comptes", label: "Comptes" },
  { href: "/immobilier", label: "Immobilier" },
  { href: "/emprunts", label: "Emprunts" },
  { href: "/transactions", label: "Transactions" },
];

export async function SiteHeader({ active = "/" }: { active?: string }) {
  const session = await getSession();
  const masque = (await cookies()).get(COOKIE_MASQUE)?.value === "1";
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span
            className="size-5 rounded-md bg-gradient-to-br from-accent to-accent-soft"
            aria-hidden
          />
          {/* Le mot-symbole coûte 75 px : sous `sm`, les trois onglets de
              navigation ne tiennent pas si on le conserve. */}
          <span className="hidden text-sm font-semibold tracking-tight text-ink sm:inline">
            Patrimoine
          </span>
        </Link>

        <nav
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none sm:gap-1"
          aria-label="Navigation principale"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-lg px-1.5 py-1.5 text-[13px] transition-colors sm:px-2.5 sm:text-sm",
                active === item.href
                  ? "text-ink"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-0.5">
          <PrivacyToggle initial={masque} />
          {/* Sous `sm`, l'action rejoint le menu utilisateur : quatre boutons
              ne tiennent pas avec les trois onglets de navigation. */}
          <RefreshButton className="hidden sm:inline-flex" />
          {session?.user && (
            <UserMenu
              email={session.user.email}
              name={session.user.name ?? undefined}
            />
          )}
        </div>
      </div>
    </header>
  );
}
