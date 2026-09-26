"use client";

import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Check, CircleCheck, Download, LoaderCircle, MessageCircle, Plus, Rocket, Send, Sparkles } from "lucide-react";
import { submitQuotation } from "@/app/actions/quotations";
import { Field, fieldAria } from "@/components/forms/field";
import { QuantityStepper } from "@/components/quantity-stepper";
import { QuoteBreakdown } from "@/components/quotations/quote-breakdown";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLATFORM } from "@/lib/business";
import { formatCurrency } from "@/lib/format";
import { quoteSummaryText, quotationRef, whatsappNumber } from "@/lib/quotations/summary";
import { cn } from "@/lib/utils";
import { quotationSchema, type QuotationValues } from "@/lib/validations/schemas";
import {
  HARDWARE,
  HARDWARE_KEYS,
  MAX_HARDWARE_UNITS,
  PLAN_KEYS,
  PLANS,
  SETUP_TYPES,
  SETUPS,
  quoteTotals,
  type HardwareKey,
  type HardwareLine,
  type PlanKey,
} from "@/lib/workshops/plans";
import { HARDWARE_ICON } from "./catalog";

type Submitted = { id: string; values: QuotationValues; hardware: HardwareLine[] };

const toLines = (hardware: Record<HardwareKey, number>): HardwareLine[] =>
  HARDWARE_KEYS.map((sku) => ({ sku, qty: hardware[sku] ?? 0 })).filter((h) => h.qty > 0);

/** Pestaña «Solicitar cotización»: plan, setup y equipamiento con total en vivo. */
export function QuotationForm({ initialPlan }: { initialPlan: PlanKey }) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  const {
    register,
    control,
    setValue,
    setError,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuotationValues>({
    // raw: el servidor valida, recalcula los montos y guarda.
    resolver: zodResolver(quotationSchema, undefined, { raw: true }),
    defaultValues: {
      workshop_name: "",
      contact_name: "",
      email: "",
      phone: "",
      comuna: "",
      plan: initialPlan,
      setup_type: "diy",
      hardware: { tablet_rugged_10: 0, printer_thermal_80: 0, pos_smart_c2c: 0 },
      website: "",
    },
    mode: "onTouched",
  });
  const [plan, setup, hardware] = useWatch({ control, name: ["plan", "setup_type", "hardware"] });
  const lines = toLines(hardware);

  function setQty(sku: HardwareKey, qty: number) {
    if (!Number.isFinite(qty)) return;
    setValue(`hardware.${sku}`, Math.min(MAX_HARDWARE_UNITS, Math.max(0, Math.trunc(qty))), { shouldDirty: true });
  }

  const onSubmit = handleSubmit(async (values) => {
    const result = await submitQuotation(values);
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0] && field !== "_form") setError(field as keyof QuotationValues, { message: messages[0] });
      }
      toast.error(result.error);
      return;
    }
    setSubmitted({ id: result.data.id, values, hardware: toLines(values.hardware) });
  });

  if (submitted) {
    return (
      <QuotationSent
        submitted={submitted}
        onNew={() => {
          reset();
          setSubmitted(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Solicita tu cotización</h1>
        <p className="text-sm text-muted-foreground">
          Arma tu paquete y ve el total al instante. Ventas te contacta para activar tu taller.
        </p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Plan de suscripción</legend>
        <div role="radiogroup" aria-label="Plan de suscripción" className="grid gap-2 @xl:grid-cols-3">
          {PLAN_KEYS.map((key) => (
            <OptionCard
              key={key}
              checked={plan === key}
              onSelect={() => setValue("plan", key, { shouldValidate: true })}
              title={PLANS[key].label}
              price={`${formatCurrency(PLANS[key].monthly)}/mes`}
              description={PLANS[key].description}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Modalidad de setup</legend>
        <div role="radiogroup" aria-label="Modalidad de setup" className="grid gap-2 @lg:grid-cols-2">
          {SETUP_TYPES.map((key) => (
            <OptionCard
              key={key}
              checked={setup === key}
              onSelect={() => setValue("setup_type", key, { shouldValidate: true })}
              title={SETUPS[key].label}
              price={SETUPS[key].fee ? `${formatCurrency(SETUPS[key].fee)} pago único` : "Sin costo"}
              description={SETUPS[key].description}
              icon={key === "turnkey" ? Sparkles : Rocket}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">
          Equipamiento <span className="font-normal text-muted-foreground">· opcional</span>
        </legend>
        <ul className="grid gap-2">
          {HARDWARE_KEYS.map((key) => {
            const item = HARDWARE[key];
            const Icon = HARDWARE_ICON[key];
            const qty = hardware[key] ?? 0;
            return (
              <li
                key={key}
                className={cn("flex items-center gap-3 rounded-xl border p-3", qty > 0 && "border-foreground bg-muted/40")}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.price)} c/u</span>
                </span>
                {qty > 0 ? (
                  <QuantityStepper value={qty} max={MAX_HARDWARE_UNITS} label={item.label} size="sm" onChange={(v) => setQty(key, v)} />
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => setQty(key, 1)}>
                    <Plus data-icon="inline-start" />
                    Agregar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {errors.hardware ? (
          <p role="alert" className="text-xs text-destructive">
            Revisa las cantidades de equipamiento (máximo {MAX_HARDWARE_UNITS} por equipo).
          </p>
        ) : null}
      </fieldset>

      <QuoteBreakdown plan={plan} setup={setup} hardware={lines} />

      <fieldset className="grid gap-4 @lg:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Datos del taller y contacto</legend>
        <Field label="Nombre del taller" htmlFor={id("workshop_name")} error={errors.workshop_name?.message} className="@lg:col-span-2">
          <Input {...fieldAria(id("workshop_name"), errors.workshop_name?.message)} {...register("workshop_name")} autoComplete="organization" />
        </Field>
        <Field label="Nombre y apellido" htmlFor={id("contact_name")} error={errors.contact_name?.message}>
          <Input {...fieldAria(id("contact_name"), errors.contact_name?.message)} {...register("contact_name")} autoComplete="name" />
        </Field>
        <Field label="Comuna" htmlFor={id("comuna")} error={errors.comuna?.message} hint="Opcional">
          <Input {...fieldAria(id("comuna"), errors.comuna?.message, true)} {...register("comuna")} autoComplete="address-level2" />
        </Field>
        <Field label="Email" htmlFor={id("email")} error={errors.email?.message}>
          <Input {...fieldAria(id("email"), errors.email?.message)} {...register("email")} type="email" autoComplete="email" />
        </Field>
        <Field label="Teléfono / WhatsApp" htmlFor={id("phone")} error={errors.phone?.message}>
          <Input
            {...fieldAria(id("phone"), errors.phone?.message)}
            {...register("phone")}
            type="tel"
            autoComplete="tel"
            placeholder="+56 9 1234 5678"
          />
        </Field>
        {/* Honeypot: oculto para personas y lectores de pantalla. */}
        <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
          <label htmlFor={id("website")}>Sitio web</label>
          <input id={id("website")} {...register("website")} tabIndex={-1} autoComplete="off" />
        </div>
      </fieldset>

      <Button type="submit" size="lg" disabled={isSubmitting} className="h-10">
        {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
        {isSubmitting ? "Enviando…" : `Enviar cotización · ${formatCurrency(quoteTotals(plan, setup, lines).initial.total)} inicial`}
      </Button>
    </form>
  );
}

function QuotationSent({ submitted, onNew }: { submitted: Submitted; onNew: () => void }) {
  const { id, values, hardware } = submitted;
  const contact = {
    workshop_name: values.workshop_name.trim(),
    contact_name: values.contact_name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim(),
    comuna: values.comuna?.trim() || null,
  };
  const text = quoteSummaryText(id, contact, values.plan, values.setup_type, hardware);
  const ref = quotationRef(id);

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cotizacion-${PLATFORM.name.toLowerCase()}-${ref}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <CircleCheck className="size-8 text-status-good" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">¡Cotización enviada!</h1>
        <p className="text-sm text-muted-foreground">
          N° <span className="font-mono font-medium text-foreground">{ref}</span> · {contact.workshop_name}. Ventas revisa tu
          solicitud y te contacta a <span className="font-medium text-foreground">{contact.email}</span> para activar tu taller.
        </p>
      </div>

      <QuoteBreakdown plan={values.plan} setup={values.setup_type} hardware={hardware} />

      <div className="grid gap-2 @lg:grid-cols-2">
        <a
          href={`https://wa.me/${whatsappNumber(PLATFORM.salesPhone)}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ size: "lg", className: "h-10" })}
        >
          <MessageCircle data-icon="inline-start" />
          Enviar por WhatsApp a Ventas
        </a>
        <Button type="button" variant="outline" size="lg" className="h-10" onClick={download}>
          <Download data-icon="inline-start" />
          Descargar resumen
        </Button>
      </div>
      <Button type="button" variant="ghost" onClick={onNew} className="justify-self-center">
        Nueva cotización
      </Button>
    </div>
  );
}

function OptionCard({
  checked,
  onSelect,
  title,
  price,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  price: string;
  description: string;
  icon?: typeof Rocket;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "grid content-start gap-1 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        checked ? "border-foreground bg-muted/40 ring-1 ring-foreground" : "hover:bg-muted/40"
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden /> : null}
        {title}
        <span
          className={cn("ml-auto flex size-4 items-center justify-center rounded-full border", checked && "border-foreground bg-foreground text-background")}
          aria-hidden
        >
          {checked ? <Check className="size-3" /> : null}
        </span>
      </span>
      <span className="text-sm font-medium tabular-nums">{price}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
