"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { completeCheckIn, stageCheckInPhoto } from "@/app/actions/check-in";
import { findMotorcycleByPlate } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import type { Appointment } from "@/lib/appointments/types";
import { SAMPLE_PHOTO_PREFIX, SAMPLE_SHOT } from "@/lib/checkin/shared";
import { demoPhotoUrl } from "@/lib/demo/photos";
import { formatKm, formatPlate } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { SERVICE_TYPE_LABEL } from "@/lib/labels";
import type { Customer, Mechanic, MotorcycleLookup } from "@/lib/orders/types";
import { cn } from "@/lib/utils";
import {
  CHECK_IN_REQUIRED_SLOTS,
  normalizePlate,
  walkInVehicleSchema,
  WORK_ORDER_PHOTO_TYPES,
  type CheckInPhotoSlot,
  type FuelLevel,
  type WalkInVehicleInput,
  type WalkInVehicleValues,
} from "@/lib/validations/schemas";
import { StepConfirm } from "./step-confirm";
import { StepIdentify } from "./step-identify";
import { StepInspection } from "./step-inspection";

export type Source = "appointment" | "walk_in";

export type Lookup = { state: "idle" | "searching" | "not_found" } | { state: "found"; data: MotorcycleLookup };

export type PhotoItem = {
  id: string;
  slot: CheckInPhotoSlot;
  /** blob: local o data URL (foto de prueba). */
  preview: string;
  status: "uploading" | "ready" | "error";
  token: string | null;
  note: string;
  error?: string;
  /** Original, para reintentar si falla la subida. */
  file?: File;
};

/** Lo que se sabe de la moto y el cliente tras el paso 1. */
export type VehicleSummary = {
  brand: string;
  model: string;
  year: number | null;
  plate: string;
  current_km: number;
  customerName: string;
  customerPhone: string | null;
  isNewMoto: boolean;
};

type Props = {
  appointments: Appointment[];
  mechanics: Mechanic[];
  initialAppointmentId: string | null;
  initialPlate: string | null;
  isDemo: boolean;
};

const STEPS = ["Identificación", "Inspección y fotos", "Confirmación"] as const;
/** Lado mayor de las fotos de recepción: nítidas para revisar detalles en el visor. */
const UPLOAD_MAX_SIDE = 2048;
const ORIGINAL_MAX_BYTES = 25 * 1024 * 1024;

const VEHICLE_DEFAULTS: WalkInVehicleValues = {
  motorcycle_mode: "new",
  motorcycle_id: null,
  plate: "",
  brand: "",
  model: "",
  year: null,
  vin: "",
  customer_mode: "new",
  customer_id: null,
  customer_name: "",
  customer_phone: "",
  customer_email: "",
};

const VEHICLE_FIELDS = new Set(Object.keys(VEHICLE_DEFAULTS));

function appointmentReason(a: Appointment) {
  return `Cita ${a.code} · ${SERVICE_TYPE_LABEL[a.service_type]}${a.notes ? `\n${a.notes}` : ""}`;
}

export function CheckInWizard({ appointments, mechanics, initialAppointmentId, initialPlate, isDemo }: Props) {
  const router = useRouter();
  const plateParam = initialPlate ? normalizePlate(initialPlate) : null;
  const initialAppointment =
    appointments.find((a) => a.id === initialAppointmentId) ??
    (plateParam ? appointments.find((a) => a.motorcycle.plate === plateParam) : undefined) ??
    null;
  const walkInPlate = initialAppointment ? null : plateParam;

  const [step, setStep] = useState(1);
  const [source, setSource] = useState<Source>(
    initialAppointment || (!walkInPlate && appointments.length > 0) ? "appointment" : "walk_in"
  );
  const [appointmentId, setAppointmentId] = useState<string | null>(initialAppointment?.id ?? null);

  // ---- Paso 1 (ingreso espontáneo): patente, moto y cliente -----------------
  const form = useForm<WalkInVehicleValues, unknown, WalkInVehicleInput>({
    resolver: zodResolver(walkInVehicleSchema),
    defaultValues: { ...VEHICLE_DEFAULTS, plate: walkInPlate ? formatPlate(walkInPlate) : "" },
  });
  const { setValue, control } = form;
  const [lookup, setLookup] = useState<Lookup>(() => (walkInPlate ? { state: "searching" } : { state: "idle" }));
  const [pickedCustomer, setPickedCustomer] = useState<Customer | null>(null);
  const plateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastPlate = useRef("");

  function applyLookup(result: MotorcycleLookup | null) {
    if (result) {
      setLookup({ state: "found", data: result });
      setValue("motorcycle_mode", "existing");
      setValue("motorcycle_id", result.motorcycle.id);
      form.clearErrors("plate");
    } else {
      setLookup({ state: "not_found" });
      setValue("motorcycle_mode", "new");
      setValue("motorcycle_id", null);
    }
  }

  function onPlateChange(raw: string) {
    const plate = normalizePlate(raw);
    clearTimeout(plateTimer.current);
    if (plate.length < 5) {
      lastPlate.current = "";
      setLookup({ state: "idle" });
      setValue("motorcycle_mode", "new");
      setValue("motorcycle_id", null);
      return;
    }
    setLookup({ state: "searching" });
    plateTimer.current = setTimeout(async () => {
      lastPlate.current = plate;
      const result = await findMotorcycleByPlate(plate);
      if (lastPlate.current === plate) applyLookup(result);
    }, 400);
  }

  // Patente precargada (?plate=): busca la moto al abrir.
  useEffect(() => {
    if (!walkInPlate) return;
    let active = true;
    lastPlate.current = walkInPlate;
    void findMotorcycleByPlate(walkInPlate).then((result) => {
      if (!active || lastPlate.current !== walkInPlate) return;
      if (result) {
        setLookup({ state: "found", data: result });
        setValue("motorcycle_mode", "existing");
        setValue("motorcycle_id", result.motorcycle.id);
      } else {
        setLookup({ state: "not_found" });
      }
    });
    return () => {
      active = false;
    };
  }, [walkInPlate, setValue]);

  const [plate, brand, model, year, customerName, customerPhone, customerMode] = useWatch({
    control,
    name: ["plate", "brand", "model", "year", "customer_name", "customer_phone", "customer_mode"],
  });

  // ---- Paso 2: inspección ---------------------------------------------------
  const [km, setKm] = useState("");
  const [fuel, setFuel] = useState<FuelLevel | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  // Libera las vistas previas locales al salir del asistente.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => photosRef.current.forEach((p) => p.preview.startsWith("blob:") && URL.revokeObjectURL(p.preview)),
    []
  );

  // ---- Paso 3: confirmación -------------------------------------------------
  const [mechanicId, setMechanicId] = useState("");
  const [reason, setReason] = useState(initialAppointment ? appointmentReason(initialAppointment) : "");
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  const appointment = source === "appointment" ? appointments.find((a) => a.id === appointmentId) ?? null : null;
  const found = lookup.state === "found" ? lookup.data : null;

  const vehicle: VehicleSummary | null = appointment
    ? {
        brand: appointment.motorcycle.brand,
        model: appointment.motorcycle.model,
        year: appointment.motorcycle.year,
        plate: appointment.motorcycle.plate,
        current_km: appointment.motorcycle.current_km,
        customerName: appointment.contact.name ?? appointment.customer.name,
        customerPhone: appointment.contact.phone ?? appointment.customer.phone,
        isNewMoto: false,
      }
    : source === "walk_in" && found
      ? {
          brand: found.motorcycle.brand,
          model: found.motorcycle.model,
          year: found.motorcycle.year,
          plate: found.motorcycle.plate,
          current_km: found.motorcycle.current_km,
          customerName: found.customer.name,
          customerPhone: found.customer.phone,
          isNewMoto: false,
        }
      : source === "walk_in" && lookup.state === "not_found"
        ? {
            brand,
            model,
            year,
            plate: normalizePlate(plate),
            current_km: 0,
            customerName: customerMode === "existing" ? pickedCustomer?.name ?? "" : customerName,
            customerPhone: customerMode === "existing" ? pickedCustomer?.phone ?? null : customerPhone || null,
            isNewMoto: true,
          }
        : null;

  const minKm = vehicle?.current_km ?? 0;
  const kmNumber = km.trim() === "" ? null : Number(km);
  const kmError =
    kmNumber === null
      ? "Ingresa el kilometraje del tablero"
      : !Number.isInteger(kmNumber) || kmNumber < 0
        ? "Kilometraje inválido"
        : kmNumber < minKm
          ? `Mínimo ${formatKm(minKm)} (último registro)`
          : null;

  const readyRequired = CHECK_IN_REQUIRED_SLOTS.filter((slot) =>
    photos.some((p) => p.slot === slot && p.status === "ready")
  ).length;
  const uploading = photos.some((p) => p.status === "uploading");

  // ---- Fotos ----------------------------------------------------------------
  /** Cualquier cambio en la inspección limpia el aviso del paso. */
  function changeKm(value: string) {
    setKm(value);
    setStepError(null);
  }

  function changeFuel(level: FuelLevel) {
    setFuel(level);
    setStepError(null);
  }

  function patchPhoto(id: string, patch: Partial<PhotoItem>) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function uploadPhoto(id: string, file: File) {
    patchPhoto(id, { status: "uploading", error: undefined });
    const compressed = await compressImage(file, UPLOAD_MAX_SIDE, 0.85);
    if (!(WORK_ORDER_PHOTO_TYPES as readonly string[]).includes(compressed.type)) {
      patchPhoto(id, { status: "error", error: "Formato no soportado" });
      return;
    }
    const result = await stageCheckInPhoto(compressed);
    if (result.ok) patchPhoto(id, { status: "ready", token: result.data.token, file: undefined });
    else patchPhoto(id, { status: "error", error: result.error });
  }

  /** Reemplaza la foto de una toma obligatoria o agrega una de daño. */
  function addPhoto(slot: CheckInPhotoSlot, file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se aceptan imágenes");
      return;
    }
    if (file.size > ORIGINAL_MAX_BYTES) {
      toast.error("La imagen supera los 25 MB");
      return;
    }
    setStepError(null);
    const item: PhotoItem = {
      id: crypto.randomUUID(),
      slot,
      preview: URL.createObjectURL(file),
      status: "uploading",
      token: null,
      note: "",
      file,
    };
    setPhotos((prev) => {
      const replaced = slot === "damage" ? [] : prev.filter((p) => p.slot === slot);
      replaced.forEach((p) => p.preview.startsWith("blob:") && URL.revokeObjectURL(p.preview));
      return [...prev.filter((p) => !replaced.includes(p)), item];
    });
    void uploadPhoto(item.id, file);
  }

  /** Modo demo: ilustración de prueba en lugar de una foto real. */
  function addSample(slot: CheckInPhotoSlot, note = "") {
    setStepError(null);
    const item: PhotoItem = {
      id: crypto.randomUUID(),
      slot,
      preview: demoPhotoUrl({
        shot: SAMPLE_SHOT[slot],
        stage: "reception",
        color: null,
        plate: vehicle?.plate ?? "",
        folio: "OT nueva",
        km: kmNumber ?? vehicle?.current_km ?? null,
        label: note || "Daño",
      }),
      status: "ready",
      token: `${SAMPLE_PHOTO_PREFIX}${slot}`,
      note,
    };
    setPhotos((prev) => [...prev.filter((p) => slot === "damage" || p.slot !== slot), item]);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.preview.startsWith("blob:")) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  function retryPhoto(id: string) {
    const item = photos.find((p) => p.id === id);
    if (item?.file) void uploadPhoto(id, item.file);
  }

  // ---- Navegación -----------------------------------------------------------
  function selectAppointment(a: Appointment) {
    setAppointmentId(a.id);
    setReason(appointmentReason(a));
    setStepError(null);
  }

  function changeSource(next: Source) {
    setSource(next);
    setStepError(null);
    if (next === "walk_in" && reason.startsWith("Cita ")) setReason("");
    if (next === "appointment" && appointment) setReason(appointmentReason(appointment));
  }

  async function goNext() {
    setStepError(null);
    if (step === 1) {
      if (source === "appointment") {
        if (!appointment) return setStepError("Selecciona la cita que estás recepcionando.");
      } else {
        if (lookup.state === "idle" || lookup.state === "searching") {
          return setStepError("Ingresa la patente y espera la búsqueda.");
        }
        if (!(await form.trigger())) return setStepError("Revisa los datos de la moto y del cliente.");
        if (lookup.state === "not_found" && customerMode === "existing" && !pickedCustomer) {
          return setStepError("Selecciona el cliente.");
        }
      }
      // Propone el último kilometraje registrado; se corrige mirando el tablero.
      if (km.trim() === "" && vehicle?.current_km) setKm(String(vehicle.current_km));
      setStep(2);
    } else if (step === 2) {
      if (kmError) return setStepError(kmError);
      if (!fuel) return setStepError("Indica el nivel de combustible.");
      if (uploading) return setStepError("Espera a que terminen de subirse las fotos.");
      if (readyRequired < CHECK_IN_REQUIRED_SLOTS.length) {
        return setStepError("Faltan fotos obligatorias: tablero, costado izquierdo y costado derecho.");
      }
      if (photos.some((p) => p.status === "error")) {
        return setStepError("Hay fotos con error: reinténtalas o quítalas.");
      }
      setStep(3);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setStepError(null);
    if (reason.trim().length < 5) return setStepError("Describe el motivo de ingreso (mín. 5 caracteres).");
    setSubmitting(true);
    const result = await completeCheckIn({
      source,
      appointment_id: source === "appointment" ? appointmentId : null,
      vehicle: source === "walk_in" ? form.getValues() : null,
      km: kmNumber,
      fuel_level: fuel,
      intake_reason: reason,
      mechanic_id: mechanicId || null,
      photos: photos
        .filter((p) => p.status === "ready" && p.token)
        .map((p) => ({ token: p.token, slot: p.slot, note: p.note })),
    });

    if (!result.ok) {
      setSubmitting(false);
      const fields = Object.keys(result.fieldErrors ?? {});
      const vehicleErrors = fields.filter((f) => VEHICLE_FIELDS.has(f));
      for (const field of vehicleErrors) {
        const message = result.fieldErrors?.[field]?.[0];
        if (message) form.setError(field as Path<WalkInVehicleValues>, { message });
      }
      if (vehicleErrors.length || fields.includes("appointment_id")) setStep(1);
      else if (fields.some((f) => f === "km" || f.startsWith("photos") || f === "fuel_level")) setStep(2);
      setStepError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success(`${result.data.folio} recepcionada con ${photos.filter((p) => p.status === "ready").length} fotos`);
    router.push(`/dashboard/orders/${result.data.id}?recepcion=1`);
  }

  return (
    <div className="grid gap-5">
      <ol className="grid grid-cols-3 gap-2" aria-label="Pasos de la recepción">
        {STEPS.map((title, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li key={title}>
              <button
                type="button"
                onClick={() => done && setStep(n)}
                disabled={!done}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl p-2.5 text-left ring-1 ring-foreground/10 transition-colors sm:p-3",
                  current ? "bg-card ring-2 ring-primary" : done ? "bg-card hover:bg-muted/60" : "bg-muted/40 text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    done ? "bg-status-good text-white" : current ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : n}
                </span>
                <span className="grid min-w-0">
                  <span className="text-[11px] tracking-wide text-muted-foreground uppercase">Paso {n}</span>
                  <span className="truncate text-sm font-medium">{title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <StepIdentify
          source={source}
          onSourceChange={changeSource}
          appointments={appointments}
          appointmentId={appointmentId}
          onSelectAppointment={selectAppointment}
          form={form}
          lookup={lookup}
          onPlateChange={onPlateChange}
          pickedCustomer={pickedCustomer}
          onPickCustomer={(c) => {
            setPickedCustomer(c);
            setValue("customer_id", c?.id ?? null);
          }}
        />
      ) : step === 2 && vehicle ? (
        <StepInspection
          vehicle={vehicle}
          km={km}
          onKmChange={changeKm}
          kmError={km.trim() === "" ? null : kmError}
          minKm={minKm}
          fuel={fuel}
          onFuelChange={changeFuel}
          photos={photos}
          readyRequired={readyRequired}
          onAddPhoto={addPhoto}
          onAddSample={isDemo ? addSample : undefined}
          onRemovePhoto={removePhoto}
          onRetryPhoto={retryPhoto}
          onNoteChange={(id, note) => patchPhoto(id, { note })}
        />
      ) : step === 3 && vehicle && fuel && kmNumber !== null ? (
        <StepConfirm
          vehicle={vehicle}
          appointment={appointment}
          km={kmNumber}
          fuel={fuel}
          photos={photos.filter((p) => p.status === "ready")}
          mechanics={mechanics}
          mechanicId={mechanicId}
          onMechanicChange={setMechanicId}
          reason={reason}
          onReasonChange={setReason}
        />
      ) : null}

      {/* Barra de acciones fija abajo: cómoda en tablet / celular. */}
      <div className="sticky bottom-0 z-10 -mx-4 grid gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:mx-0 md:rounded-xl md:border md:px-4">
        {stepError ? (
          <p role="alert" className="text-sm text-destructive">
            {stepError}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          {step > 1 ? (
            <Button variant="outline" size="lg" className="h-11 px-4" onClick={goBack} disabled={submitting}>
              <ArrowLeft data-icon="inline-start" />
              Atrás
            </Button>
          ) : null}
          <span className="ml-auto hidden text-sm text-muted-foreground sm:inline">
            {step === 2 ? `Fotos obligatorias ${readyRequired}/${CHECK_IN_REQUIRED_SLOTS.length}` : `Paso ${step} de 3`}
          </span>
          {step < 3 ? (
            <Button size="lg" className="ml-auto h-11 px-5 sm:ml-0" onClick={goNext}>
              Continuar
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button size="lg" className="ml-auto h-11 px-5 sm:ml-0" onClick={submit} disabled={submitting}>
              {submitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
              Confirmar recepción y crear OT
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
