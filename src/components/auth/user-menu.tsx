"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui";
import { signOut } from "@/lib/auth-client";

export function UserMenu({ email, name }: { email: string; name?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Compte utilisateur">
          <User className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Le libellé du menu est en capitales par défaut ; une adresse
            e-mail doit rester telle qu'elle a été saisie. */}
        <DropdownMenuLabel className="font-normal normal-case tracking-normal">
          <span className="block text-sm text-ink">{name || "Connecté"}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-faint">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            start(async () => {
              await signOut();
              router.push("/connexion");
              router.refresh();
            });
          }}
        >
          <LogOut className="size-4" aria-hidden />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
