"use client";

import { useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, CircleCheck, LoaderCircle, MapPin, Printer } from "lucide-react";
import { createAppointment } from "@/app/actions/appointments";
import { SERVICE_ICON } from "@/components/appointments/badges";
import { SlotPicker } from "@/components/appointments/slot-picker";
import { Field, fieldAria } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_DURATION } from "@/lib/appointments/schedule";
import type { BookingResult } from "@/lib/appointments/types";
import { WORKSHOP } from "@/lib/business";
import { formatFullDate, toDateKey, toTimeKey } from "@/lib/datetime";
import { PUBLIC_SERVICE_COPY } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  bookingSchema,
  serviceTypeSchema,
  type BookingInput,
  type BookingValues,
} from "@/lib/validations/schemas";

const STEPS = [
  { title: "Servicio", fields: ["service_type"] },
  { title: "Tu moto", fields: ["plate", "brand", "model", "year", "customer_name", "customer_phone", "customer_email"] },
  { title: "Fecha y hora", fields: ["date", "time"] },
  { title: "Confirmación", fields: [] },
] as const satisfies { title: string; fields: readonly Path<BookingValues>[] }[];

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
  website: "",
};

export function BookingWizard() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ booking: BookingResult; values: BookingInput } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<BookingValues, unknown, BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: DEFAULTS,
    mode: "onTouched",
  });
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    trigger,
    getValues,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = form;
  const [service, date, time] = useWatch({ control, name: ["service_type", "date", "time"] });

  async function next() {
    const ok = await trigger([...STEPS[step].fields]);
    if (ok) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const response = await createAppointment(values, "public");
    if (!response.ok) {
      const fields = Object.keys(response.fieldErrors ?? {});
      for (const [field, messages] of Object.entries(response.fieldErrors ?? {})) {
        if (messages?.[0]) setError(field as Path<BookingValues>, { message: messages[0] });
      }
      // Vuelve al paso donde está el problema (p. ej. horario tomado mientras completaba).
      const target = STEPS.findIndex((s) => s.fields.some((f) => fields.includes(f)));
      if (target >= 0) setStep(target);
      if (fields.includes("time")) setValue("time", "");
      setSubmitError(response.error);
      return;
    }
    setResult({ booking: response.data, values });
  });

  if (result) {
    return (
      <Receipt
        booking={result.booking}
        values={result.values}
        onNew={() => {
          reset(DEFAULTS);
          setResult(null);
          setStep(0);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      {/* Progreso */}
      <ol className="grid grid-cols-4 gap-2" aria-label="Pasos de la reserva">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.title}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                aria-current={current ? "step" : undefined}
                className="grid w-full gap-1.5 text-left disabled:cursor-default"
              >
                <span className={cn("h-1 rounded-full bg-muted", (done || current) && "bg-foreground")} />
                <span className={cn("flex items-center gap-1 text-xs", current ? "font-semibold" : "text-muted-foreground")}>
                  {done ? <Check className="size-3.5" aria-hidden /> : <span className="tabular-nums">{i + 1}.</span>}
                  <span className="truncate">{s.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {submitError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      {/* Honeypot anti-bots (invisible para personas). */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          No completar
          <input type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>

      {step === 0 ? (
        <fieldset className="grid gap-3">
          <legend className="mb-3 text-lg font-semibold">¿Qué necesita tu moto?</legend>
          {serviceTypeSchema.options.map((s) => {
            const Icon = SERVICE_ICON[s];
            const selected = service === s;
            return (
              <label
                key={s}
                className={cn(
                  "flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  selected ? "border-foreground bg-muted/50" : "bg-card hover:bg-muted/30"
                )}
              >
                <input type="radio" value={s} {...register("service_type")} className="sr-only" />
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="grid gap-0.5">
                  <span className="font-medium">{PUBLIC_SERVICE_COPY[s].title}</span>
                  <span className="text-sm text-muted-foreground">{PUBLIC_SERVICE_COPY[s].description}</span>
                  <span className="text-xs text-muted-foreground">Duración estimada: {SERVICE_DURATION[s]} min</span>
                </span>
                <CircleCheck className={cn("ml-auto size-5 shrink-0", selected ? "text-foreground" : "text-transparent")} aria-hidden />
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-6">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-lg font-semibold">Datos de la moto</legend>
            <Field label="Patente" htmlFor="b-plate" error={errors.plate?.message} className="sm:col-span-2">
              <Input {...fieldAria("b-plate", errors.plate?.message)} {...register("plate")} placeholder="AB·123" autoComplete="off" className="font-mono uppercase sm:max-w-48" />
            </Field>
            <Field label="Marca" htmlFor="b-brand" error={errors.brand?.message}>
              <Input {...fieldAria("b-brand", errors.brand?.message)} {...register("brand")} placeholder="Honda" />
            </Field>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <Field label="Modelo" htmlFor="b-model" error={errors.model?.message}>
                <Input {...fieldAria("b-model", errors.model?.message)} {...register("model")} placeholder="CB 190R" />
              </Field>
              <Field label="Año" htmlFor="b-year" error={errors.year?.message}>
                <Input
                  {...fieldAria("b-year", errors.year?.message)}
                  {...register("year", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
                  type="number"
                  inputMode="numeric"
                  placeholder="2021"
                />
              </Field>
            </div>
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-lg font-semibold">Tus datos</legend>
            <Field label="Nombre y apellido" htmlFor="b-name" error={errors.customer_name?.message} className="sm:col-span-2">
              <Input {...fieldAria("b-name", errors.customer_name?.message)} {...register("customer_name")} autoComplete="name" />
            </Field>
            <Field label="Teléfono / WhatsApp" htmlFor="b-phone" error={errors.customer_phone?.message} hint="Te contactamos para confirmar el turno.">
              <Input {...fieldAria("b-phone", errors.customer_phone?.message, true)} {...register("customer_phone")} type="tel" autoComplete="tel" placeholder="+56 9 1234 5678" />
            </Field>
            <Field label="Email (opcional)" htmlFor="b-email" error={errors.customer_email?.message}>
              <Input {...fieldAria("b-email", errors.customer_email?.message)} {...register("customer_email")} type="email" autoComplete="email" />
            </Field>
            <Field label="¿Algo que debamos saber? (opcional)" htmlFor="b-notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea
                {...fieldAria("b-notes", errors.notes?.message)}
                {...register("notes")}
                rows={3}
                placeholder="Kilometraje actual, ruidos, fallas, pedidos especiales…"
              />
            </Field>
          </fieldset>
        </div>
      ) : null}

      {step === 2 ? (
        <fieldset className="grid gap-3">
          <legend className="mb-3 text-lg font-semibold">Elige día y horario</legend>
          <SlotPicker
            service={service}
            date={date || null}
            time={time || null}
            onChange={(d, t) => {
              setValue("date", d ?? "", { shouldValidate: Boolean(errors.date) });
              setValue("time", t ?? "", { shouldValidate: Boolean(errors.time) });
            }}
            dateError={errors.date?.message}
            timeError={errors.time?.message}
          />
        </fieldset>
      ) : null}

      {step === 3 ? <Review values={getValues()} /> : null}

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        {step > 0 ? (
          <Button type="button" variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} disabled={isSubmitting}>
            <ArrowLeft data-icon="inline-start" />
            Atrás
          </Button>
        ) : (
          <span />
        )}
        {/* Keys distintas: si React reutilizara el mismo <button>, al pasar al
            último paso se volvería type="submit" durante el clic de
            «Continuar» y enviaría la reserva sin pasar por la revisión. */}
        {step < STEPS.length - 1 ? (
          <Button key="next" type="button" size="lg" onClick={next}>
            Continuar
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button key="submit" type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
            Confirmar reserva
          </Button>
        )}
      </div>
    </form>
  );
}

function Review({ values }: { values: BookingValues }) {
  const rows: [string, React.ReactNode][] = [
    ["Servicio", `${PUBLIC_SERVICE_COPY[values.service_type].title} · ${SERVICE_DURATION[values.service_type]} min`],
    ["Fecha", values.date ? formatFullDate(values.date) : "—"],
    ["Hora", values.time ? `${values.time} h` : "—"],
    [
      "Moto",
      <>
        {values.brand} {values.model} {values.year ?? ""} · <span className="font-mono">{values.plate.toUpperCase()}</span>
      </>,
    ],
    ["A nombre de", values.customer_name],
    ["Contacto", [values.customer_phone, values.customer_email].filter(Boolean).join(" · ")],
  ];
  if (values.notes) rows.push(["Observaciones", values.notes]);

  return (
    <section className="grid gap-3" aria-labelledby="review-title">
      <h2 id="review-title" className="text-lg font-semibold">
        Revisa tu reserva
      </h2>
      <dl className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-[9rem_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Al confirmar, el taller se comunicará con vos para validar el turno. Podés cancelarlo o reprogramarlo llamando al{" "}
        {WORKSHOP.phone}.
      </p>
    </section>
  );
}

function Receipt({ booking, values, onNew }: { booking: BookingResult; values: BookingInput; onNew: () => void }) {
  const start = new Date(booking.starts_at);
  return (
    <section className="grid gap-6" aria-labelledby="receipt-title">
      <div className="grid justify-items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-status-good/15">
          <CircleCheck className="size-6 text-status-good" aria-hidden />
        </span>
        <h2 id="receipt-title" className="text-2xl font-semibold tracking-tight">
          ¡Turno reservado!
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Guardá este número de reserva. Te contactaremos al {values.customer_phone} para confirmar.
        </p>
      </div>

      <article className="mx-auto grid w-full max-w-md gap-4 rounded-2xl border-2 border-dashed bg-card p-6 print:border-solid">
        <div className="text-center">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Número de reserva</p>
          <p className="font-mono text-3xl font-bold tracking-wider">{booking.code}</p>
        </div>
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2 border-t pt-4 text-sm">
          <dt className="text-muted-foreground">Día</dt>
          <dd className="font-medium">{formatFullDate(toDateKey(start))}</dd>
          <dt className="text-muted-foreground">Hora</dt>
          <dd className="font-medium">{toTimeKey(start)} h (aprox. {booking.duration_minutes} min)</dd>
          <dt className="text-muted-foreground">Servicio</dt>
          <dd className="font-medium">{PUBLIC_SERVICE_COPY[values.service_type].title}</dd>
          <dt className="text-muted-foreground">Moto</dt>
          <dd className="font-medium">
            {values.brand} {values.model} · <span className="font-mono">{values.plate}</span>
          </dd>
          <dt className="text-muted-foreground">A nombre de</dt>
          <dd className="font-medium">{values.customer_name}</dd>
        </dl>
        <p className="flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {WORKSHOP.name} · {WORKSHOP.address} · {WORKSHOP.phone}
        </p>
      </article>

      <div className="flex flex-wrap justify-center gap-2 print:hidden">
        <Button variant="outline" size="lg" onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          Imprimir o guardar
        </Button>
        <Button size="lg" onClick={onNew}>
          Agendar otro turno
        </Button>
      </div>
    </section>
  );
}
