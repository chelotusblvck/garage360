import type { Metadata } from "next";
import { Clock, MapPin, Phone, ShieldCheck } from "lucide-react";
import { BUSINESS_HOURS_LABEL } from "@/lib/appointments/schedule";
import { WORKSHOP } from "@/lib/business";
import { BookingWizard } from "./booking-wizard";

export const metadata: Metadata = {
  title: "Agendar servicio",
  description: "Reservá online el service, la revisión o el diagnóstico de tu moto.",
};

export default function BookingPage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="grid content-start gap-6">
        <div className="grid gap-1 print:hidden">
          <h1 className="text-3xl font-semibold tracking-tight">Agendá el service de tu moto</h1>
          <p className="text-muted-foreground">Elegí el servicio, cargá los datos y reservá el horario que te quede cómodo.</p>
        </div>
        <BookingWizard />
      </div>

      <aside className="grid content-start gap-4 text-sm print:hidden">
        <div className="grid gap-3 rounded-xl bg-muted/50 p-4">
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="block font-medium">Horarios</span>
              {BUSINESS_HOURS_LABEL}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="block font-medium">{WORKSHOP.name}</span>
              {WORKSHOP.address}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="block font-medium">Consultas</span>
              {WORKSHOP.phone}
            </span>
          </p>
        </div>
        <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Usamos tus datos solo para gestionar el turno. No necesitás crear una cuenta.
        </p>
      </aside>
    </div>
  );
}
