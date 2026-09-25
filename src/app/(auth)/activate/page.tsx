import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { hashActivationToken } from "@/lib/activation";
import { getWorkshopRepository } from "@/lib/workshops/repository";
import { ActivateForm } from "./activate-form";

export const metadata: Metadata = { title: "Activa tu cuenta" };

/** Enlace de invitación del admin de un taller nuevo (generado en /admin). */
export default async function ActivatePage({ searchParams }: PageProps<"/activate">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token.trim() : "";
  const invite = value ? await getWorkshopRepository().lookupActivation(hashActivationToken(value)) : null;

  if (!invite) {
    return (
      <div className="grid gap-4 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <LinkIcon className="size-5" aria-hidden />
        </span>
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Este enlace ya no es válido</h1>
          <p className="text-sm text-muted-foreground">
            Puede que haya vencido o que la cuenta ya esté activada. Si ya la activaste, inicia sesión; si no, pide un
            enlace nuevo a soporte.
          </p>
        </div>
        <Link href="/login" className={buttonVariants({ className: "mx-auto" })}>
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Invitación</p>
        <h1 className="text-2xl font-semibold tracking-tight">Activa tu cuenta de {invite.workshopName}</h1>
        <p className="text-sm text-muted-foreground">
          Crea tu contraseña para entrar como administrador. Después configuras el taller en tres pasos.
        </p>
      </div>
      <ActivateForm token={value} email={invite.email} name={invite.name} />
    </div>
  );
}
