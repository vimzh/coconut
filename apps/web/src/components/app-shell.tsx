// Shared navigation and content landmarks for the evaluation workbench and public reports.
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";

const navigation = [
  { id: "evaluate", href: "/evaluate", label: "Evaluate" },
  { id: "methodology", href: "/methodology", label: "Methodology" },
  { id: "pitch", href: "/pitch", label: "Pitch" },
] as const;

type AppShellProps = {
  activePage?: (typeof navigation)[number]["id"];
  children: ReactNode;
  className?: string;
  surfaceClassName?: string;
  showBrand?: boolean;
};

export function AppShell({ activePage, children, className, surfaceClassName, showBrand = false }: AppShellProps) {
  return (
    <div className={cn("flex min-h-screen flex-col bg-background text-foreground", surfaceClassName)}>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      >
        Skip to content
      </a>

      <header className={showBrand ? "border-b bg-white" : undefined}>
        <div className={cn("mx-auto flex min-h-16 max-w-[1440px] items-center px-4 py-3 sm:px-6 lg:px-8", showBrand ? "justify-between" : "justify-center")}>
          {showBrand && <Link href="/" className="flex items-center gap-2 text-base font-medium tracking-tight"><Image src="/coconut.svg" alt="" width={32} height={32} />Coconut</Link>}
          <nav
            aria-label="Main navigation"
            className={cn("flex flex-wrap items-center justify-center gap-1", showBrand ? "font-sans" : "font-serif")}
          >
            {navigation.map(({ id, href, label }) => (
              <Link
                key={id}
                href={href}
                aria-current={activePage === id ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center rounded-none px-3 outline-none transition-colors hover:bg-white hover:text-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
                  showBrand ? "text-xs sm:text-sm" : "text-base",
                  activePage === id
                    ? showBrand ? "font-medium text-accent" : "bg-white font-medium text-green-800"
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
