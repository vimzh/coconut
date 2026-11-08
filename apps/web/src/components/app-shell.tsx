// Shared navigation and content landmarks for the evaluation workbench and public reports.
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

const navigation = [
  { id: "evaluate", href: "/evaluate", label: "Evaluate" },
  { id: "leaderboard", href: "/leaderboard", label: "Leaderboard" },
  { id: "methodology", href: "/methodology", label: "Methodology" },
] as const;

type AppShellProps = {
  activePage?: (typeof navigation)[number]["id"];
  children: ReactNode;
  className?: string;
  surfaceClassName?: string;
};

export function AppShell({ activePage, children, className, surfaceClassName }: AppShellProps) {
  return (
    <div className={cn("flex min-h-screen flex-col bg-background text-foreground", surfaceClassName)}>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      >
        Skip to content
      </a>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Coconut home"
            className="inline-flex items-center gap-3 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Image src="/coconut.svg" width={40} height={40} alt="" className="shrink-0" />
            <span className="text-lg font-medium">Coconut</span>
            <span className="hidden border-l border-border pl-3 text-sm text-muted-foreground sm:inline">
              Convexity evaluation
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="flex w-full items-center gap-1 sm:w-auto"
          >
            {navigation.map(({ id, href, label }) => (
              <Link
                key={id}
                href={href}
                aria-current={activePage === id ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
                  activePage === id
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 outline-none sm:px-6 lg:px-8",
          className,
        )}
      >
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1440px] px-4 py-4 text-xs leading-5 text-muted-foreground sm:px-6 lg:px-8">
          Model evaluations over explicit mathematical domains
        </div>
      </footer>
    </div>
  );
}
