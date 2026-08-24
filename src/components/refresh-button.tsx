"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { invalidateQuotes } from "@/server/actions";
import { cn } from "@/lib/utils";

export function RefreshButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Rafraîchir les cours"
      disabled={pending}
      className={className}
      onClick={() =>
        start(async () => {
          await invalidateQuotes();
          toast.success("Cours mis à jour.");
        })
      }
    >
      <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden />
    </Button>
  );
}
