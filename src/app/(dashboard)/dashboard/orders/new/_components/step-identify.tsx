"use client";

import { useId } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { CalendarCheck, CircleCheck, Footprints, LoaderCircle, Search, UserPlus, Users } from "lucide-react";
import { AppointmentStatusBadge, ServiceTypeBadge } from "@/components/appointments/badges";
import { Field, fieldAria } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import type { Appointment } from "@/lib/appointments/types";
import { formatFullDate, toDateKey, todayKey, toTimeKey } from "@/lib/datetime";
import { formatKm, formatPlate } from "@/lib/format";
import type { Customer } from "@/lib/orders/types";
import { cn } from "@/lib/utils";
import type { WalkInVehicleInput, WalkInVehicleValues } from "@/lib/validations/schemas";
import type { Lookup, Source } from "./check-in-wizard";
import { CustomerSearch } from "./customer-search";

type Props = {
  source: Source;
  onSourceChange: (source: Source) => void;
  appointments: Appointment[];
  appointmentId: string | null;
  onSelectAppointment: (appointment: Appointment) => void;
  form: UseFormReturn<WalkInVehicleValues, unknown, WalkInVehicleInput>;
  lookup: Lookup;
  onPlateChange: (plate: string) => void;
  pickedCustomer: Customer | null;
  onPickCustomer: (customer: Customer | null) => void;
};

/** Paso 1: de dónde viene la moto (cita agendada o ingreso espontáneo). */
export function StepIdentify(props: Props) {
  const { source, onSourceChange, appointments } = props;
  return (
    <section className="grid gap-4" aria-labelledby="identify-title">
      <h2 id="identify-title" className="sr-only">
        Identificación
      </h2>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Origen del ingreso">
        <SourceCard
          selected={source === "appointment"}
          onSelect={() => onSourceChange("appointment")}
          icon={CalendarCheck}
          title="Cita agendada"
          description={
            appointments.length
              ? `${appointments.length} ${appointments.length === 1 ? "cita pendiente" : "citas pendientes"} de recepción hoy`
              : "No quedan citas pendientes hoy"
          }
        />
        <SourceCard
          selected={source === "walk_in"}
          onSelect={() => onSourceChange("walk_in")}
          icon={Footprints}
          title="Ingreso espontáneo"
          description="Sin cita: busca por patente o registra la moto"
        />
      </div>

      {source === "appointment" ? <AppointmentPicker {...props} /> : <WalkInForm {...props} />}
    </section>
  );
}

function SourceCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: typeof CalendarCheck;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "ring-2 ring-primary" : "hover:bg-muted/50"
      )}
    >
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", selected ? "bg-primary text-primary-foreground" : "bg-muted")}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function AppointmentPicker({ appointments, appointmentId, onSelectAppointment, onSourceChange }: Props) {
  if (appointments.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        <CalendarCheck className="size-6" aria-hidden />
        <p>No hay citas agendadas o confirmadas pendientes de recepción para hoy.</p>
        <button type="button" onClick={() => onSourceChange("walk_in")} className="font-medium text-foreground underline underline-offset-4">
          Registrar un ingreso espontáneo
        </button>
      </div>
    );
  }

  const today = todayKey();
  return (
    <ul className="grid gap-2 lg:grid-cols-2" role="radiogroup" aria-label="Citas pendientes de recepción">
      {appointments.map((a) => {
        const selected = a.id === appointmentId;
        const start = new Date(a.starts_at);
        const day = toDateKey(start);
        return (
          <li key={a.id}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelectAppointment(a)}
              className={cn(
                "grid w-full gap-2 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected ? "ring-2 ring-primary" : "hover:bg-muted/40"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold tabular-nums">{toTimeKey(start)}</span>
                {day !== today ? <span className="text-xs text-muted-foreground">{formatFullDate(day)}</span> : null}
                <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                <span className="ml-auto flex gap-1.5">
                  <ServiceTypeBadge service={a.service_type} />
                  <AppointmentStatusBadge status={a.status} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="grid min-w-0">
                  <span className="truncate font-medium">
                    {a.motorcycle.brand} {a.motorcycle.model}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {a.contact.name ?? a.customer.name}
                    {a.contact.phone ?? a.customer.phone ? ` · ${a.contact.phone ?? a.customer.phone}` : ""}
                  </span>
                </div>
                <span className="shrink-0 rounded border-2 border-foreground/80 px-1.5 font-mono text-sm font-semibold tracking-wider">
                  {formatPlate(a.motorcycle.plate)}
                </span>
              </div>
              {a.notes ? <p className="line-clamp-2 text-sm text-muted-foreground">{a.notes}</p> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function WalkInForm({ form, lookup, onPlateChange, pickedCustomer, onPickCustomer }: Props) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const {
    register,
    setValue,
    control,
    clearErrors,
    formState: { errors },
  } = form;
  const customerMode = useWatch({ control, name: "customer_mode" });
  const plateField = register("plate");
  const found = lookup.state === "found" ? lookup.data : null;

  return (
    <div className="grid gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <Field label="Patente" htmlFor={id("plate")} error={errors.plate?.message} hint="Si la moto ya vino al taller, se recuperan sus datos y los del cliente.">
        <div className="relative sm:max-w-sm">
          <Input
            {...fieldAria(id("plate"), errors.plate?.message, true)}
            {...plateField}
            onChange={(e) => {
              void plateField.onChange(e);
              onPlateChange(e.target.value);
            }}
            placeholder="AB·123"
            autoComplete="off"
            autoFocus
            className="h-12 pr-10 font-mono text-lg tracking-wider uppercase"
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
            {lookup.state === "searching" ? (
              <LoaderCircle className="size-5 animate-spin" aria-label="Buscando moto" />
            ) : lookup.state === "found" ? (
              <CircleCheck className="size-5 text-status-good" aria-label="Moto encontrada" />
            ) : (
              <Search className="size-5" aria-hidden />
            )}
          </span>
        </div>
      </Field>

      {found ? (
        <div className="grid gap-1 rounded-lg bg-muted/60 p-3 text-sm ring-1 ring-foreground/10" aria-live="polite">
          <p className="font-medium">
            {found.motorcycle.brand} {found.motorcycle.model} {found.motorcycle.year}
          </p>
          <p className="text-muted-foreground">
            Cliente: <span className="text-foreground">{found.customer.name}</span>
            {found.customer.phone ? ` · ${found.customer.phone}` : ""}
          </p>
          <p className="text-muted-foreground">Último kilometraje: {formatKm(found.motorcycle.current_km)}</p>
        </div>
      ) : null}

      {lookup.state === "not_found" ? (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Patente nueva: registra la moto y su dueño.
          </p>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_7rem]">
            <Field label="Marca" htmlFor={id("brand")} error={errors.brand?.message}>
              <Input {...fieldAria(id("brand"), errors.brand?.message)} {...register("brand")} placeholder="Ducati" className="h-11" />
            </Field>
            <Field label="Modelo" htmlFor={id("model")} error={errors.model?.message}>
              <Input {...fieldAria(id("model"), errors.model?.message)} {...register("model")} placeholder="Monster 937" className="h-11" />
            </Field>
            <Field label="Año" htmlFor={id("year")} error={errors.year?.message}>
              <Input
                {...fieldAria(id("year"), errors.year?.message)}
                {...register("year", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
                type="number"
                inputMode="numeric"
                placeholder="2023"
                className="h-11"
              />
            </Field>
          </div>

          <div className="grid gap-4 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Cliente</h3>
              <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Tipo de cliente">
                {(
                  [
                    { value: "new", label: "Nuevo", icon: UserPlus },
                    { value: "existing", label: "Existente", icon: Users },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={customerMode === option.value}
                    onClick={() => {
                      setValue("customer_mode", option.value);
                      clearErrors();
                    }}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground",
                      customerMode === option.value && "bg-background text-foreground shadow-xs ring-1 ring-foreground/10"
                    )}
                  >
                    <option.icon className="size-4" aria-hidden />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {customerMode === "existing" ? (
              <CustomerSearch inputId={id("customer")} error={errors.customer_id?.message} selected={pickedCustomer} onSelect={onPickCustomer} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Nombre y apellido" htmlFor={id("customer_name")} error={errors.customer_name?.message}>
                  <Input
                    {...fieldAria(id("customer_name"), errors.customer_name?.message)}
                    {...register("customer_name")}
                    autoComplete="off"
                    className="h-11"
                  />
                </Field>
                <Field label="Teléfono / WhatsApp" htmlFor={id("customer_phone")} error={errors.customer_phone?.message}>
                  <Input
                    {...fieldAria(id("customer_phone"), errors.customer_phone?.message)}
                    {...register("customer_phone")}
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    className="h-11"
                  />
                </Field>
                <Field label="Email (opcional)" htmlFor={id("customer_email")} error={errors.customer_email?.message}>
                  <Input
                    {...fieldAria(id("customer_email"), errors.customer_email?.message)}
                    {...register("customer_email")}
                    type="email"
                    className="h-11"
                  />
                </Field>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
