"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { findNavItem } from "./nav-config";

export function DashboardHeader({ isDemo }: { isDemo: boolean }) {
  const pathname = usePathname();
  const current = findNavItem(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-center" />
      <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Panel</span>
        {current ? (
          <>
            <span className="text-muted-foreground/60" aria-hidden>
              /
            </span>
            <span className="truncate font-medium">{current.title}</span>
          </>
        ) : null}
      </nav>
      {isDemo ? (
        <span className="ml-auto shrink-0 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap text-muted-foreground">
          Modo demo<span className="hidden sm:inline"> · datos de ejemplo</span>
        </span>
      ) : null}
    </header>
  );
}
