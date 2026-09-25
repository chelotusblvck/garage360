"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Plus, Rocket, Sparkles } from "lucide-react";
import { createWorkshop } from "@/app/actions/admin";
import { Field, fieldAria } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { newWorkshopSchema, type NewWorkshopValues } from "@/lib/validations/schemas";
import { PLAN_KEYS, PLANS, SETUP_TYPES, SETUPS, initialCharge } from "@/lib/workshops/plans";

const STEPS = [
  { title: "Plan e implementación", fields: ["plan", "setup_type"] },
  { title: "Taller y administrador", fields: ["name", "city", "phone", "admin_name", "admin_email"] },
  { title: "Confirmar", fields: [] },
] as const satisfies readonly { title: string; fields: readonly FieldPath<NewWorkshopValues>[] }[];

const DEFAULTS: NewWorkshopValues = {
  plan: "pro",
  setup_type: "diy",
  name: "",
  city: "",
  phone: "",
  admin_name: "",
  admin_email: "",
};

/** Botón «Nuevo taller» + asistente de alta (solo en /admin). */
export function NewWorkshopWizard() {
  const [open, setOpen] = useState(false);
  // key: cada apertura empieza de cero.
  const [session, setSession] = useState(0);
  return (
    <>
      <Button
        onClick={() => {
          setSession((s) => s + 1);
          setOpen(true);
        }}
      >
        <Plus data-icon="inline-start" />
        Nuevo taller
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-3xl">
          <WizardBody key={session} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function WizardBody({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [step, setStep] = useState(0);

  const {
    register,
    control,
    trigger,
    setValue,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewWorkshopValues>({
    // raw: el servidor valida y transforma; el fee de setup lo calcula él.
    resolver: zodResolver(newWorkshopSchema, undefined, { raw: true }),
    defaultValues: DEFAULTS,
    mode: "onTouched",
  });
  const [plan, setup, name, city, adminName, adminEmail] = useWatch({
    control,
    name: ["plan", "setup_type", "name", "city", "admin_name", "admin_email"],
  });
  const charge = initialCharge(plan, setup);

  async function next() {
    if (await trigger(STEPS[step].fields)) setStep((s) => s + 1);
  }

  const onSubmit = handleSubmit(async (values) => {
    const result = await createWorkshop(values);
    if (!result.ok) {
      let firstStep: number | null = null;
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (!messages?.[0] || field === "_form") continue;
        setError(field as FieldPath<NewWorkshopValues>, { message: messages[0] });
        const at = STEPS.findIndex((s) => (s.fields as readonly string[]).includes(field));
        if (at >= 0) firstStep = Math.min(firstStep ?? at, at);
      }
      if (firstStep !== null) setStep(firstStep);
      toast.error(result.error);
      return;
    }
    toast.success(`${result.data.name} creado`, {
      description: `${values.admin_email} debe crear su cuenta en /register con ese email para entrar como administrador.`,
    });
    onDone();
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="contents">
      <DialogHeader className="gap-3 pr-8">
        <DialogTitle>Nuevo taller</DialogTitle>
        <DialogDescription>
          Paso {step + 1} de {STEPS.length} · {STEPS[step].title}
        </DialogDescription>
        <ol className="grid grid-cols-3 gap-2" aria-hidden>
          {STEPS.map((s, i) => (
            <li key={s.title} className={cn("h-1 rounded-full bg-muted", i <= step && "bg-foreground")} />
          ))}
        </ol>
      </DialogHeader>

      <div className="-mx-4 min-h-0 overflow-y-auto px-4 py-1">
        {step === 0 ? (
          <div className="grid gap-5">
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Plan de suscripción</legend>
              <div role="radiogroup" aria-label="Plan de suscripción" className="grid gap-2 sm:grid-cols-3">
                {PLAN_KEYS.map((key) => (
                  <OptionCard
                    key={key}
                    checked={plan === key}
                    onSelect={() => setValue("plan", key, { shouldValidate: true })}
                    title={PLANS[key].label}
                    price={`${formatCurrency(PLANS[key].monthly)}/mes`}
                    description={PLANS[key].description}
                    items={PLANS[key].features}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Modalidad de implementación</legend>
              <div role="radiogroup" aria-label="Modalidad de implementación" className="grid gap-2 sm:grid-cols-2">
                {SETUP_TYPES.map((key) => (
                  <OptionCard
                    key={key}
                    checked={setup === key}
                    onSelect={() => setValue("setup_type", key, { shouldValidate: true })}
                    title={SETUPS[key].label}
                    price={SETUPS[key].fee ? `+${formatCurrency(SETUPS[key].fee)} pago único` : `${formatCurrency(0)}`}
                    description={SETUPS[key].description}
                    icon={key === "turnkey" ? Sparkles : Rocket}
                  />
                ))}
              </div>
            </fieldset>

            <ChargeBreakdown plan={plan} setup={setup} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-6">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase sm:col-span-6">Taller</p>
            <Field label="Nombre comercial" htmlFor={id("name")} error={errors.name?.message} className="sm:col-span-6">
              <Input {...fieldAria(id("name"), errors.name?.message)} {...register("name")} autoComplete="off" autoFocus />
            </Field>
            <Field label="Comuna" htmlFor={id("city")} error={errors.city?.message} hint="Opcional" className="sm:col-span-3">
              <Input {...fieldAria(id("city"), errors.city?.message, true)} {...register("city")} autoComplete="off" />
            </Field>
            <Field label="Teléfono" htmlFor={id("phone")} error={errors.phone?.message} hint="Opcional" className="sm:col-span-3">
              <Input {...fieldAria(id("phone"), errors.phone?.message, true)} {...register("phone")} type="tel" autoComplete="off" />
            </Field>

            <p className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:col-span-6">Administrador del taller</p>
            <Field label="Nombre" htmlFor={id("admin_name")} error={errors.admin_name?.message} className="sm:col-span-3">
              <Input {...fieldAria(id("admin_name"), errors.admin_name?.message)} {...register("admin_name")} autoComplete="off" />
            </Field>
            <Field
              label="Email"
              htmlFor={id("admin_email")}
              error={errors.admin_email?.message}
              hint="Al crear su cuenta con este email queda como admin y entra al onboarding"
              className="sm:col-span-3"
            >
              <Input {...fieldAria(id("admin_email"), errors.admin_email?.message, true)} {...register("admin_email")} type="email" autoComplete="off" />
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4">
            <dl className="grid gap-x-6 gap-y-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
              <Summary label="Taller" value={[name, city].filter(Boolean).join(" · ")} />
              <Summary label="Administrador" value={`${adminName} · ${adminEmail}`} />
              <Summary label="Plan" value={`${PLANS[plan].label} · ${formatCurrency(PLANS[plan].monthly)}/mes`} />
              <Summary label="Implementación" value={SETUPS[setup].label} />
            </dl>
            <ChargeBreakdown plan={plan} setup={setup} />
            <p className="text-xs text-muted-foreground">
              El taller queda con el onboarding pendiente: su administrador completa datos, equipo y tarifas al primer ingreso.
              {setup === "turnkey" ? " Con Llave en Mano, el equipo de implementación agenda la carga de datos y la capacitación." : ""}
            </p>
          </div>
        ) : null}
      </div>

      <DialogFooter className="sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={isSubmitting}>
            <ArrowLeft data-icon="inline-start" />
            Atrás
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">
            Cobro inicial <span className="font-semibold text-foreground">{formatCurrency(charge.total)}</span>
          </span>
          {/* Keys distintas: evita que React reutilice el botón y envíe el formulario al cambiar de tipo. */}
          {step < STEPS.length - 1 ? (
            <Button key="next" type="button" onClick={next}>
              Continuar
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button key="submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
              Crear taller
            </Button>
          )}
        </div>
      </DialogFooter>
    </form>
  );
}

function OptionCard({
  checked,
  onSelect,
  title,
  price,
  description,
  items,
  icon: Icon,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  price: string;
  description: string;
  items?: string[];
  icon?: typeof Rocket;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "grid content-start gap-1.5 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
      {items ? (
        <ul className="mt-1 grid gap-0.5 text-xs text-muted-foreground">
          {items.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      ) : null}
    </button>
  );
}

function ChargeBreakdown({ plan, setup }: { plan: NewWorkshopValues["plan"]; setup: NewWorkshopValues["setup_type"] }) {
  const { monthly, setupFee, total } = initialCharge(plan, setup);
  return (
    <section aria-label="Desglose del cobro inicial" className="grid gap-1.5 rounded-xl bg-muted/60 p-4 text-sm">
      <div className="flex justify-between gap-4">
        <span>Suscripción mensual · {PLANS[plan].label}</span>
        <span className="tabular-nums">{formatCurrency(monthly)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>Setup · {SETUPS[setup].label}</span>
        <span className="tabular-nums">{setupFee ? formatCurrency(setupFee) : "Sin costo"}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-foreground/10 pt-2">
        <span className="font-medium">Total inicial a cobrar</span>
        <span className="text-lg font-semibold tabular-nums">{formatCurrency(total)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        IVA incluido. Luego {formatCurrency(monthly)} al mes{setupFee ? "; el setup se cobra una sola vez" : ""}.
      </p>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
