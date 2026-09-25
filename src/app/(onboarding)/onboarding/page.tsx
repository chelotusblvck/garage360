import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getCurrentWorkshop, requireWorkshopAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import type { OnboardingValues } from "@/lib/validations/schemas";
import { DEFAULT_RECEPTION_POLICY } from "@/lib/workshops/shared";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Configura tu taller" };

/** Primera configuración del taller: solo su administrador, y solo una vez. */
export default async function OnboardingPage() {
  const profile = await requireWorkshopAdmin();
  const workshop = await getCurrentWorkshop();
  if (!workshop || workshop.onboarding_completed) redirect("/dashboard");

  const defaults: OnboardingValues = {
    profile: {
      name: workshop.name,
      rut: workshop.rut ?? "",
      city: workshop.city ?? "",
      address: workshop.address ?? "",
      phone: workshop.phone ?? "",
      email: workshop.email ?? profile.email,
      specialty: workshop.specialty ?? "",
      logo_url: workshop.logo_url ?? "",
    },
    staff: [],
    settings: {
      hourly_rate: workshop.hourly_rate,
      tax_percent: Math.round(workshop.tax_rate * 1000) / 10,
      reception_policy: workshop.reception_policy ?? DEFAULT_RECEPTION_POLICY,
    },
  };

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
          <Logo />
          <span className="text-sm text-muted-foreground">· Configuración inicial</span>
          <form action={logout} className="ml-auto">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut data-icon="inline-start" />
              Salir
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6 px-4 py-8">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Hola {profile.name.split(" ")[0]}, configuremos tu taller</h1>
          <p className="text-sm text-muted-foreground">
            Tres pasos y queda listo: estos datos aparecen en los comprobantes, en las OTs y en el panel.
          </p>
        </div>
        <OnboardingWizard defaults={defaults} isDemo={!isSupabaseConfigured()} />
      </main>
    </div>
  );
}
