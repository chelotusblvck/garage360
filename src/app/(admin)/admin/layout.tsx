import type { Metadata } from "next";
import { LogOut, ShieldCheck } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { requireSuperadmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Superadmin", template: "%s · Superadmin · MotoOps" } };

/** Consola Garage360: solo rol superadmin (el resto vuelve a su pantalla de inicio). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireSuperadmin();

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 md:px-6">
          <Logo />
          <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            <ShieldCheck className="size-3.5" aria-hidden />
            Superadmin
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right text-xs leading-tight sm:grid">
              <span className="font-medium text-foreground">{profile.name}</span>
              <span className="text-muted-foreground">
                {profile.email}
                {profile.isDemo ? " · demo" : ""}
              </span>
            </span>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut data-icon="inline-start" />
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
