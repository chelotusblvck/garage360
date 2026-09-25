"use client";

import { Info } from "lucide-react";
import { Field } from "@/components/forms/field";
import { FuelGauge } from "@/components/orders/fuel-gauge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment } from "@/lib/appointments/types";
import { checkInCaption } from "@/lib/checkin/shared";
import { formatKm, formatPlate } from "@/lib/format";
import type { Mechanic } from "@/lib/orders/types";
import type { FuelLevel } from "@/lib/validations/schemas";
import type { PhotoItem, VehicleSummary } from "./check-in-wizard";

type Props = {
  vehicle: VehicleSummary;
  appointment: Appointment | null;
  km: number;
  fuel: FuelLevel;
  photos: PhotoItem[];
  mechanics: Mechanic[];
  mechanicId: string;
  onMechanicChange: (id: string) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
};

/** Paso 3: resumen, motivo de ingreso y mecánico antes de generar la OT. */
export function StepConfirm({
  vehicle,
  appointment,
  km,
  fuel,
  photos,
  mechanics,
  mechanicId,
  onMechanicChange,
  reason,
  onReasonChange,
}: Props) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" aria-labelledby="confirm-title">
      <div className="grid content-start gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <h2 id="confirm-title" className="font-semibold">
          Resumen de la recepción
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Origen</dt>
            <dd>{appointment ? `Cita ${appointment.code}` : "Ingreso espontáneo"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Cliente</dt>
            <dd>
              {vehicle.customerName || "—"}
              {vehicle.customerPhone ? <span className="text-muted-foreground"> · {vehicle.customerPhone}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Moto</dt>
            <dd>
              {vehicle.brand} {vehicle.model} {vehicle.year ?? ""} ·{" "}
              <span className="font-mono font-medium">{formatPlate(vehicle.plate)}</span>
              {vehicle.isNewMoto ? <span className="text-muted-foreground"> (nueva)</span> : null}
            </dd>
          </div>
          <div className="flex gap-6">
            <div>
              <dt className="text-xs text-muted-foreground">Kilometraje</dt>
              <dd className="font-medium tabular-nums">{formatKm(km)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Combustible</dt>
              <dd>
                <FuelGauge level={fuel} />
              </dd>
            </div>
          </div>
        </dl>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Fotos de recepción ({photos.length})</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} className="grid gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local */}
                <img src={p.preview} alt="" className="aspect-[4/3] w-full rounded-md object-cover ring-1 ring-foreground/10" />
                <span className="line-clamp-2 text-xs text-muted-foreground">{checkInCaption(p.slot, p.note.trim() || null)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid content-start gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <Field label="Motivo de ingreso" htmlFor="checkin-reason" hint="Lo que reporta el cliente: mantención, ruidos, fallas, pedidos especiales.">
          <Textarea
            id="checkin-reason"
            aria-describedby="checkin-reason-hint"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={5}
            maxLength={1000}
            autoFocus={!reason}
          />
        </Field>
        <Field label="Mecánico asignado" htmlFor="checkin-mechanic">
          <NativeSelect id="checkin-mechanic" value={mechanicId} onChange={(e) => onMechanicChange(e.target.value)} className="w-full [&_select]:h-11">
            <NativeSelectOption value="">Sin asignar</NativeSelectOption>
            {mechanics.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Se creará la OT en estado «Recepcionada» con las fotos en la etapa de recepción
            {appointment ? ` y la cita ${appointment.code} quedará como atendida` : ""}. Luego podrás imprimir o enviar el
            comprobante de recepción.
          </span>
        </p>
      </div>
    </section>
  );
}
