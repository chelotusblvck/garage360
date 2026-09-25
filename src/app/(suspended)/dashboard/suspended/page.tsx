import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut, Mail, MessageCircle, OctagonPause } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Wordmark } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentProfile, getCurrentWorkshop, homePathFor } from "@/lib/auth";
import { PLATFORM } from "@/lib/business";
import { whatsappUrl } from "@/lib/customers/shared";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Taller suspendido" };

/**
 * Pantalla de bloqueo por mora. Vive fuera del layout del panel (grupo propio)
 * para no entrar en el redirect de requireStaff. El superadmin en modo soporte
 * nunca llega aquí.
 */
export default async function SuspendedPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const workshop = await getCurrentWorkshop();
  if (profile.support || !workshop?.suspended_at) redirect(homePathFor(profile));

  const message = `Hola, soy ${profile.name} de ${workshop.name}. Quiero regularizar el pago de MotoOps para reactivar el taller.`;

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center px-4">
          <Wordmark />
          <form action={logout} className="ml-auto">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut data-icon="inline-start" />
              Salir
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-xl flex-1 place-items-center px-4 py-10">
        <div className="grid w-full gap-5 rounded-2xl border bg-background p-6 text-center shadow-sm">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-critical/10 text-status-critical">
            <OctagonPause className="size-6" aria-hidden />
          </span>
          <div className="grid gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">El acceso de {workshop.name} está suspendido</h1>
            <p className="text-sm text-muted-foreground">
              Desde el {formatDate(new Date(workshop.suspended_at))}, por pagos pendientes de la suscripción. Tus datos están
              guardados: al regularizar el pago el panel vuelve a estar disponible tal como lo dejaste.
            </p>
          </div>
          {workshop.suspension_reason ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-left text-sm">
              <span className="font-medium">Motivo:</span> {workshop.suspension_reason}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a href={`${whatsappUrl(PLATFORM.supportPhone)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={buttonVariants()}>
              <MessageCircle data-icon="inline-start" />
              Hablar con cobranza
            </a>
            <a
              href={`mailto:${PLATFORM.supportEmail}?subject=${encodeURIComponent(`Reactivación · ${workshop.name}`)}&body=${encodeURIComponent(message)}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Mail data-icon="inline-start" />
              {PLATFORM.supportEmail}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
