"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { createAppointment } from "@/app/actions/appointments";
import { findMotorcycleByPlate } from "@/app/actions/orders";
import { SERVICE_ICON } from "@/components/appointments/badges";
import { SlotPicker } from "@/components/appointments/slot-picker";
import { Field, fieldAria } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_DURATION } from "@/lib/appointments/schedule";
import { formatFullDate } from "@/lib/datetime";
import { formatKm, formatPlate } from "@/lib/format";
import { PUBLIC_SERVICE_COPY } from "@/lib/labels";
import type { MotorcycleLookup } from "@/lib/orders/types";
import { cn } from "@/lib/utils";
import {
  bookingSchema,
  normalizePlate,
  serviceTypeSchema,
  type BookingInput,
  type BookingValues,
} from "@/lib/validations/schemas";

export function NewAppointmentSheet({
  open,
  onOpenChange,
  onCreated,
  initialPlate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (date: string) => void;
  initialPlate?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Nueva cita</SheetTitle>
          <SheetDescription>Agendamiento interno (teléfono, mostrador, WhatsApp).</SheetDescription>
        </SheetHeader>
        <NewAppointmentForm
          initialPlate={initialPlate}
          onDone={(date) => {
            onOpenChange(false);
            if (date) onCreated(date);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

const DEFAULTS: BookingValues = {
  service_type: "maintenance",
  date: "",
  time: "",
  notes: "",
  motorcycle_id: null,
  plate: "",
  brand: "",
  model: "",
  year: null,
  customer_name: "",
  customer_phone: "",
  customer_email: "",
};

type Lookup = { state: "idle" | "searching" | "not_found" } | { state: "found"; data: MotorcycleLookup };

function NewAppointmentForm({ initialPlate, onDone }: { initialPlate?: string; onDone: (date?: string) => void }) {
  const form = useForm<BookingValues, unknown, BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { ...DEFAULTS, plate: initialPlate ? formatPlate(normalizePlate(initialPlate)) : "" },
  });
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const [service, date, time] = useWatch({ control, name: ["service_type", "date", "time"] });

  const [lookup, setLookup] = useState<Lookup>(() => (initialPlate ? { state: "searching" } : { state: "idle" }));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastPlate = useRef("");

  // Patente precargada (?plate=): busca la moto al abrir.
  useEffect(() => {
    if (!initialPlate) return;
    const plate = normalizePlate(initialPlate);
    let active = true;
    lastPlate.current = plate;
    void findMotorcycleByPlate(plate).then((result) => {
      if (!active || lastPlate.current !== plate) return;
      if (result) {
        setLookup({ state: "found", data: result });
        setValue("motorcycle_id", result.motorcycle.id);
      } else {
        setLookup({ state: "not_found" });
      }
    });
    return () => {
      active = false;
    };
  }, [initialPlate, setValue]);

  function onPlateChange(raw: string) {
    const plate = normalizePlate(raw);
    clearTimeout(timer.current);
    setValue("motorcycle_id", null);
    if (plate.length < 5) {
      lastPlate.current = "";
      setLookup({ state: "idle" });
      return;
    }
    setLookup({ state: "searching" });
    timer.current = setTimeout(async () => {
      lastPlate.current = plate;
      const result = await findMotorcycleByPlate(plate);
      if (lastPlate.current !== plate) return;
      if (result) {
        setLookup({ state: "found", data: result });
        setValue("motorcycle_id", result.motorcycle.id);
        form.clearErrors();
      } else {
        setLookup({ state: "not_found" });
      }
    }, 400);
  }

  const plateField = register("plate");
  const found = lookup.state === "found" ? lookup.data : null;

  const onSubmit = handleSubmit(async (values) => {
    const result = await createAppointment(values, "staff");
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) setError(field as Path<BookingValues>, { message: messages[0] });
      }
      toast.error(result.error);
      return;
    }
    toast.success(`Cita ${result.data.code} agendada · ${formatFullDate(values.date)}, ${values.time} h`);
    onDone(values.date);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-1 content-start gap-6 overflow-y-auto p-4">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">1. Servicio</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de servicio">
            {serviceTypeSchema.options.map((s) => {
              const Icon = SERVICE_ICON[s];
              const selected = service === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValue("service_type", s)}
                  className={cn(
                    "grid gap-1 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
                  )}
                >
                  <Icon className={cn("size-4", selected ? "text-foreground" : "text-muted-foreground")} aria-hidden />
                  <span className="text-sm font-medium">{PUBLIC_SERVICE_COPY[s].title}</span>
                  <span className="text-xs text-muted-foreground">{SERVICE_DURATION[s]} min</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <section className="grid gap-4" aria-label="Moto y cliente">
          <h3 className="text-sm font-semibold">2. Moto y cliente</h3>
          <Field label="Patente" htmlFor="appt-plate" error={errors.plate?.message} hint="Si la moto ya vino al taller, se usan sus datos.">
            <div className="relative">
              <Input
                {...fieldAria("appt-plate", errors.plate?.message, true)}
                {...plateField}
                onChange={(e) => {
                  void plateField.onChange(e);
                  onPlateChange(e.target.value);
                }}
                placeholder="AB·123"
                autoComplete="off"
                className="pr-8 font-mono uppercase"
              />
              <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground">
                {lookup.state === "searching" ? (
                  <LoaderCircle className="size-4 animate-spin" aria-label="Buscando moto" />
                ) : found ? (
                  <CircleCheck className="size-4 text-status-good" aria-label="Moto encontrada" />
                ) : (
                  <Search className="size-4" aria-hidden />
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
            <div className="grid gap-4 sm:grid-cols-2">
              <p className="text-xs text-muted-foreground sm:col-span-2" aria-live="polite">
                Patente nueva: completa los datos de la moto y del cliente.
              </p>
              <Field label="Marca" htmlFor="appt-brand" error={errors.brand?.message}>
                <Input {...fieldAria("appt-brand", errors.brand?.message)} {...register("brand")} placeholder="Honda" />
              </Field>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field label="Modelo" htmlFor="appt-model" error={errors.model?.message}>
                  <Input {...fieldAria("appt-model", errors.model?.message)} {...register("model")} placeholder="Wave 110" />
                </Field>
                <Field label="Año" htmlFor="appt-year" error={errors.year?.message}>
                  <Input
                    {...fieldAria("appt-year", errors.year?.message)}
                    {...register("year", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
                    type="number"
                    inputMode="numeric"
                    placeholder="2021"
                  />
                </Field>
              </div>
              <Field label="Nombre del cliente" htmlFor="appt-name" error={errors.customer_name?.message}>
                <Input {...fieldAria("appt-name", errors.customer_name?.message)} {...register("customer_name")} autoComplete="off" />
              </Field>
              <Field label="Teléfono" htmlFor="appt-phone" error={errors.customer_phone?.message}>
                <Input {...fieldAria("appt-phone", errors.customer_phone?.message)} {...register("customer_phone")} type="tel" placeholder="+56 9 1234 5678" />
              </Field>
              <Field label="Email (opcional)" htmlFor="appt-email" error={errors.customer_email?.message} className="sm:col-span-2">
                <Input {...fieldAria("appt-email", errors.customer_email?.message)} {...register("customer_email")} type="email" />
              </Field>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3" aria-label="Fecha y hora">
          <h3 className="text-sm font-semibold">3. Fecha y hora</h3>
          <SlotPicker
            service={service}
            date={date || null}
            time={time || null}
            onChange={(d, t) => {
              setValue("date", d ?? "", { shouldValidate: form.formState.isSubmitted });
              setValue("time", t ?? "", { shouldValidate: form.formState.isSubmitted });
            }}
            dateError={errors.date?.message}
            timeError={errors.time?.message}
          />
        </section>

        <Field label="Observaciones (opcional)" htmlFor="appt-notes" error={errors.notes?.message}>
          <Textarea
            {...fieldAria("appt-notes", errors.notes?.message)}
            {...register("notes")}
            rows={3}
            placeholder="Kilometraje, síntomas, pedidos del cliente…"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t bg-muted/40 p-4">
        <Button type="button" variant="outline" onClick={() => onDone()} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || lookup.state === "searching" || lookup.state === "idle"}>
          {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
          Agendar cita
        </Button>
      </div>
    </form>
  );
}
