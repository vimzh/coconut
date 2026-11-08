// Shared navigation and content landmarks for the evaluation workbench and public reports.
import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const navigation = [
  { id: "evaluate", href: "/evaluate", label: "Evaluate" },
  { id: "leaderboard", href: "/leaderboard", label: "Leaderboard" },
  { id: "methodology", href: "/methodology", label: "Methodology" },
  { id: "pitch", href: "/pitch", label: "Pitch" },
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

      <header>
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-center px-4 py-3 sm:px-6 lg:px-8">
          <nav
            aria-label="Main navigation"
            className="flex flex-wrap items-center justify-center gap-1 font-serif"
          >
            {navigation.map(({ id, href, label }) => (
              <Link
                key={id}
                href={href}
                aria-current={activePage === id ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center rounded-none px-3 text-base outline-none transition-colors hover:bg-white hover:text-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
                  activePage === id
                    ? "bg-white font-medium text-green-800"
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

    </div>
  );
}
