import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Patrimoine",
  description:
    "Suivi de patrimoine personnel : comptes, placements et performance, réunis dans une seule vue claire.",
};

export const viewport: Viewport = {
  themeColor: "#07070a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`dark ${inter.variable} h-full antialiased`}>
      <body className="bg-canvas text-ink flex min-h-full flex-col font-sans">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          closeButton
          richColors={false}
          offset={20}
          toastOptions={{
            style: {
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-hairline-strong)",
              color: "var(--color-ink)",
              borderRadius: "0.875rem",
              boxShadow: "var(--shadow-popover)",
            },
            classNames: {
              title: "text-ink text-sm font-medium",
              description: "text-ink-muted text-[13px]",
              actionButton: "bg-accent text-white",
              cancelButton: "bg-surface-3 text-ink-muted",
              closeButton:
                "bg-surface-3 border-hairline-strong text-ink-muted hover:text-ink",
              success: "text-positive",
              error: "text-negative",
            },
          }}
        />
      </body>
    </html>
  );
}
