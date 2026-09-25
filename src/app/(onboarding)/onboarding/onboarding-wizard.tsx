"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ImagePlus, LoaderCircle, Plus, Trash2, UserRound, X } from "lucide-react";
import { completeOnboarding } from "@/app/actions/onboarding";
import { Field, fieldAria } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { onboardingSchema, type OnboardingValues } from "@/lib/validations/schemas";
import { STAFF_ROLE_LABEL, WORKSHOP_SPECIALTIES } from "@/lib/workshops/shared";

const STEPS = [
  { key: "profile", title: "Datos del taller", description: "Cómo te verán tus clientes en comprobantes y mensajes." },
  { key: "staff", title: "Staff y mecánicos", description: "El equipo inicial que atiende las órdenes de trabajo." },
  { key: "settings", title: "Parámetros y tarifas", description: "Valor hora, IVA y política de recepción de motos." },
] as const;

const EMPTY_MEMBER: OnboardingValues["staff"][number] = { name: "", email: "", phone: "", role: "mechanic", specialty: "" };

/** Lado máximo del logo: suficiente para el panel y los comprobantes, liviano como data URL. */
const LOGO_SIZE = 256;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function OnboardingWizard({ defaults, isDemo }: { defaults: OnboardingValues; isDemo: boolean }) {
  const router = useRouter();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [step, setStep] = useState(0);
  const logoInput = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    trigger,
    setValue,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingValues>({
    // raw: el servidor valida y transforma ("" → null); si recibiera la salida ya
    // transformada, el mismo esquema la rechazaría.
    resolver: zodResolver(onboardingSchema, undefined, { raw: true }),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const staff = useFieldArray({ control, name: "staff" });
  const [logo, hourlyRate, taxPercent] = useWatch({
    control,
    name: ["profile.logo_url", "settings.hourly_rate", "settings.tax_percent"],
  });

  const pe = errors.profile;
  const se = errors.settings;

  async function next() {
    const ok = await trigger(STEPS[step].key);
    if (ok) setStep((s) => s + 1);
  }

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Elige una imagen (PNG, JPG o WebP)");
      return;
    }
    const compressed = await compressImage(file, LOGO_SIZE, 0.9);
    setValue("profile.logo_url", await readAsDataUrl(compressed), { shouldDirty: true, shouldValidate: true });
  }

  const onSubmit = handleSubmit(async (values) => {
    const result = await completeOnboarding(values);
    if (!result.ok) {
      let firstStep: number | null = null;
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (!messages?.[0] || field === "_form") continue;
        setError(field as FieldPath<OnboardingValues>, { message: messages[0] });
        const at = STEPS.findIndex((s) => field.startsWith(s.key));
        if (at >= 0) firstStep = Math.min(firstStep ?? at, at);
      }
      if (firstStep !== null) setStep(firstStep);
      toast.error(result.error);
      return;
    }
    toast.success("¡Taller configurado! Ya puedes recibir motos.");
    router.replace("/dashboard");
  });

  // Ejemplo de liquidación con los valores ingresados (precios con IVA incluido).
  const sample = Number.isFinite(hourlyRate) ? Math.round(hourlyRate * 1.5) : 0;
  const sampleNet = Number.isFinite(taxPercent) ? Math.round(sample / (1 + taxPercent / 100)) : sample;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      {/* Progreso */}
      <ol className="grid grid-cols-3 gap-2" aria-label="Pasos de la configuración">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                aria-current={current ? "step" : undefined}
                className="grid w-full gap-1.5 text-left disabled:cursor-default"
              >
                <span className={cn("h-1 rounded-full bg-muted", (done || current) && "bg-brand")} />
                <span className={cn("flex items-center gap-1 text-xs", current ? "font-semibold" : "text-muted-foreground")}>
                  {done ? <Check className="size-3.5" aria-hidden /> : <span className="tabular-nums">{i + 1}.</span>}
                  <span className="truncate">{s.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step].title}</CardTitle>
          <CardDescription>{STEPS[step].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 0 ? (
            <div className="grid gap-4 sm:grid-cols-6">
              <div className="flex items-center gap-4 sm:col-span-6">
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/50 text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-label={logo ? "Cambiar logo" : "Subir logo"}
                >
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vista previa en data URL
                    <img src={logo} alt="" className="size-full object-cover" />
                  ) : (
                    <ImagePlus className="size-6" aria-hidden />
                  )}
                </button>
                <div className="grid gap-1 text-sm">
                  <p className="font-medium">Logo del taller</p>
                  <p className="text-xs text-muted-foreground">Opcional · PNG, JPG o WebP. Se ajusta a {LOGO_SIZE} px.</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => logoInput.current?.click()}>
                      {logo ? "Cambiar" : "Subir logo"}
                    </Button>
                    {logo ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setValue("profile.logo_url", "", { shouldDirty: true })}>
                        <X data-icon="inline-start" />
                        Quitar
                      </Button>
                    ) : null}
                  </div>
                  {pe?.logo_url?.message ? <p className="text-xs text-destructive">{pe.logo_url.message}</p> : null}
                </div>
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void pickLogo(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>

              <Field label="Nombre comercial" htmlFor={id("name")} error={pe?.name?.message} className="sm:col-span-4">
                <Input {...fieldAria(id("name"), pe?.name?.message)} {...register("profile.name")} autoComplete="organization" autoFocus />
              </Field>
              <Field label="RUT" htmlFor={id("rut")} error={pe?.rut?.message} hint="Empresa o persona" className="sm:col-span-2">
                <Input {...fieldAria(id("rut"), pe?.rut?.message, true)} {...register("profile.rut")} placeholder="76.543.210-3" className="font-mono" />
              </Field>
              <Field label="Dirección" htmlFor={id("address")} error={pe?.address?.message} className="sm:col-span-4">
                <Input {...fieldAria(id("address"), pe?.address?.message)} {...register("profile.address")} autoComplete="street-address" placeholder="Av. Francisco Bilbao 2850" />
              </Field>
              <Field label="Comuna" htmlFor={id("city")} error={pe?.city?.message} className="sm:col-span-2">
                <Input {...fieldAria(id("city"), pe?.city?.message)} {...register("profile.city")} autoComplete="address-level2" placeholder="Providencia" />
              </Field>
              <Field label="Teléfono / WhatsApp" htmlFor={id("phone")} error={pe?.phone?.message} className="sm:col-span-3">
                <Input {...fieldAria(id("phone"), pe?.phone?.message)} {...register("profile.phone")} type="tel" autoComplete="tel" placeholder="+56 9 8765 4321" />
              </Field>
              <Field label="Email de contacto" htmlFor={id("email")} error={pe?.email?.message} className="sm:col-span-3">
                <Input {...fieldAria(id("email"), pe?.email?.message)} {...register("profile.email")} type="email" autoComplete="email" />
              </Field>
              <Field label="Especialidad" htmlFor={id("specialty")} error={pe?.specialty?.message} hint="Elige una o escribe la tuya" className="sm:col-span-6">
                <Input {...fieldAria(id("specialty"), pe?.specialty?.message, true)} {...register("profile.specialty")} list={id("specialties")} placeholder="Multimarca" autoComplete="off" />
                <datalist id={id("specialties")}>
                  {WORKSHOP_SPECIALTIES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4">
              {staff.fields.length === 0 ? (
                <div className="grid justify-items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center">
                  <UserRound className="size-8 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-medium">Aún no agregas a tu equipo</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Registra a los mecánicos para asignarles órdenes de trabajo. Puedes omitir este paso si trabajas solo.
                  </p>
                </div>
              ) : (
                <ul className="grid gap-3">
                  {staff.fields.map((field, i) => {
                    const e = errors.staff?.[i];
                    return (
                      <li key={field.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-6">
                        <Field label="Nombre" htmlFor={id(`s${i}-name`)} error={e?.name?.message} className="sm:col-span-3">
                          <Input {...fieldAria(id(`s${i}-name`), e?.name?.message)} {...register(`staff.${i}.name`)} autoComplete="off" />
                        </Field>
                        <Field label="Rol" htmlFor={id(`s${i}-role`)} className="sm:col-span-2">
                          <NativeSelect id={id(`s${i}-role`)} {...register(`staff.${i}.role`)} className="w-full">
                            {Object.entries(STAFF_ROLE_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                        <div className="flex items-end justify-end sm:col-span-1">
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar persona ${i + 1}`} onClick={() => staff.remove(i)}>
                            <Trash2 />
                          </Button>
                        </div>
                        <Field label="Email" htmlFor={id(`s${i}-email`)} error={e?.email?.message} hint={isDemo ? undefined : "Para darle acceso"} className="sm:col-span-2">
                          <Input {...fieldAria(id(`s${i}-email`), e?.email?.message, !isDemo)} {...register(`staff.${i}.email`)} type="email" autoComplete="off" />
                        </Field>
                        <Field label="Teléfono" htmlFor={id(`s${i}-phone`)} error={e?.phone?.message} className="sm:col-span-2">
                          <Input {...fieldAria(id(`s${i}-phone`), e?.phone?.message)} {...register(`staff.${i}.phone`)} type="tel" autoComplete="off" />
                        </Field>
                        <Field label="Especialidad" htmlFor={id(`s${i}-specialty`)} error={e?.specialty?.message} className="sm:col-span-2">
                          <Input {...fieldAria(id(`s${i}-specialty`), e?.specialty?.message)} {...register(`staff.${i}.specialty`)} placeholder="Electrónica, suspensión…" autoComplete="off" />
                        </Field>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button type="button" variant="outline" className="w-fit" onClick={() => staff.append(EMPTY_MEMBER)} disabled={staff.fields.length >= 30}>
                <Plus data-icon="inline-start" />
                Agregar persona
              </Button>
              <p className="text-xs text-muted-foreground">
                {isDemo
                  ? "Modo demo: los mecánicos quedan disponibles de inmediato para asignar en las OTs."
                  : "Quienes tengan email reciben acceso de staff al crear su cuenta con ese email (o de inmediato, si ya la tienen)."}
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Valor hora de mano de obra (CLP)" htmlFor={id("rate")} error={se?.hourly_rate?.message} hint="Sugerido al cargar trabajos en una OT" className="sm:col-span-3">
                <Input
                  {...fieldAria(id("rate"), se?.hourly_rate?.message, true)}
                  {...register("settings.hourly_rate", { valueAsNumber: true })}
                  type="number"
                  inputMode="numeric"
                  min={1000}
                  step={500}
                />
              </Field>
              <Field label="IVA (%)" htmlFor={id("tax")} error={se?.tax_percent?.message} hint="En Chile: 19 %" className="sm:col-span-3">
                <Input
                  {...fieldAria(id("tax"), se?.tax_percent?.message, true)}
                  {...register("settings.tax_percent", { valueAsNumber: true })}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={50}
                  step={0.1}
                />
              </Field>
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground sm:col-span-6">
                Los precios se ingresan con IVA incluido. Ejemplo: 1,5 h de trabajo ={" "}
                <span className="font-medium text-foreground tabular-nums">{formatCurrency(sample)}</span> (neto{" "}
                <span className="tabular-nums">{formatCurrency(sampleNet)}</span> + IVA{" "}
                <span className="tabular-nums">{formatCurrency(sample - sampleNet)}</span>).
              </p>
              <Field
                label="Política de recepción"
                htmlFor={id("policy")}
                error={se?.reception_policy?.message}
                hint="Se imprime en el comprobante de recepción que firma el cliente"
                className="sm:col-span-6"
              >
                <Textarea {...fieldAria(id("policy"), se?.reception_policy?.message, true)} {...register("settings.reception_policy")} rows={6} />
              </Field>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} disabled={isSubmitting}>
            <ArrowLeft data-icon="inline-start" />
            Atrás
          </Button>
        ) : (
          <span />
        )}
        {/* Keys distintas: evita que React reutilice el botón y envíe el formulario al cambiar de tipo. */}
        {step < STEPS.length - 1 ? (
          <Button key="next" type="button" size="lg" onClick={next}>
            {step === 1 && staff.fields.length === 0 ? "Omitir por ahora" : "Continuar"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button key="submit" type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
            Finalizar y abrir el panel
          </Button>
        )}
      </div>
    </form>
  );
}
