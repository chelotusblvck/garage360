import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCheckInAppointments } from "@/app/actions/check-in";
import { getMechanics } from "@/app/actions/orders";
import { isSupabaseConfigured } from "@/lib/env";
import { CheckInWizard } from "./_components/check-in-wizard";

export const metadata: Metadata = { title: "Recepcionar moto" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Recepción de motos (check-in): identificación → inspección con fotos
 * obligatorias → confirmación. Es la única forma de abrir una OT.
 */
export default async function CheckInPage({ searchParams }: PageProps<"/dashboard/orders/new">) {
  const params = await searchParams;
  const appointmentId = first(params.appointment) ?? null;
  const [appointments, mechanics] = await Promise.all([getCheckInAppointments(appointmentId), getMechanics()]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="grid gap-3">
        <Link
          href="/dashboard/orders"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Órdenes de trabajo
        </Link>
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Recepcionar moto</h1>
          <p className="text-sm text-muted-foreground">
            Registro de ingreso con fotos obligatorias (tablero y ambos costados) antes de abrir la orden de trabajo.
          </p>
        </div>
      </div>
      <CheckInWizard
        appointments={appointments}
        mechanics={mechanics}
        initialAppointmentId={appointmentId}
        initialPlate={first(params.plate) ?? null}
        isDemo={!isSupabaseConfigured()}
      />
    </div>
  );
}
