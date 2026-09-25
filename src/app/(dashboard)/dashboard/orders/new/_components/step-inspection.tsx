"use client";

import { useId } from "react";
import { Camera, CircleAlert, CircleCheck, Gauge, ImagePlus, LoaderCircle, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CHECK_IN_SLOT_COPY,
  DAMAGE_PRESETS,
  FUEL_LEVEL_BARS,
  FUEL_LEVEL_LABEL,
  FUEL_LEVELS,
} from "@/lib/checkin/shared";
import { formatKm, formatPlate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CHECK_IN_REQUIRED_SLOTS, type CheckInPhotoSlot, type FuelLevel } from "@/lib/validations/schemas";
import type { PhotoItem, VehicleSummary } from "./check-in-wizard";

type Props = {
  vehicle: VehicleSummary;
  km: string;
  onKmChange: (km: string) => void;
  kmError: string | null;
  minKm: number;
  fuel: FuelLevel | null;
  onFuelChange: (fuel: FuelLevel) => void;
  photos: PhotoItem[];
  readyRequired: number;
  onAddPhoto: (slot: CheckInPhotoSlot, file: File) => void;
  /** Solo modo demo: usar una ilustración como foto. */
  onAddSample?: (slot: CheckInPhotoSlot, note?: string) => void;
  onRemovePhoto: (id: string) => void;
  onRetryPhoto: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
};

/** Paso 2: checklist de ingreso con fotos obligatorias. */
export function StepInspection(props: Props) {
  const { vehicle, km, onKmChange, kmError, minKm, fuel, onFuelChange, photos, readyRequired, onAddSample } = props;
  const damage = photos.filter((p) => p.slot === "damage");
  const missing = CHECK_IN_REQUIRED_SLOTS.filter((slot) => !photos.some((p) => p.slot === slot));

  return (
    <section className="grid gap-5" aria-labelledby="inspection-title">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="grid">
          <h2 id="inspection-title" className="font-semibold">
            {vehicle.brand} {vehicle.model} {vehicle.year ?? ""}
          </h2>
          <p className="text-sm text-muted-foreground">
            {vehicle.customerName || "Cliente nuevo"}
            {vehicle.isNewMoto ? " · moto nueva en el taller" : ` · último registro ${formatKm(vehicle.current_km)}`}
          </p>
        </div>
        <span className="rounded border-2 border-foreground/80 px-2 py-0.5 font-mono text-base font-semibold tracking-wider">
          {formatPlate(vehicle.plate)}
        </span>
      </div>

      {/* Kilometraje y combustible */}
      <div className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <div className="grid content-start gap-1.5">
          <label htmlFor="checkin-km" className="flex items-center gap-1.5 text-sm font-medium">
            <Gauge className="size-4 text-muted-foreground" aria-hidden />
            Kilometraje de entrada
          </label>
          <div className="relative">
            <Input
              id="checkin-km"
              type="number"
              inputMode="numeric"
              min={minKm}
              value={km}
              onChange={(e) => onKmChange(e.target.value)}
              aria-invalid={kmError ? true : undefined}
              aria-describedby="checkin-km-help"
              className="h-14 pr-12 text-2xl font-semibold tabular-nums"
              placeholder="0"
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">km</span>
          </div>
          <p id="checkin-km-help" className={cn("text-xs", kmError ? "text-destructive" : "text-muted-foreground")}>
            {kmError ?? (minKm ? `Mínimo ${formatKm(minKm)}. Cópialo del tablero.` : "Cópialo del tablero.")}
          </p>
        </div>

        <fieldset className="grid content-start gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Nivel de combustible</legend>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Nivel de combustible">
            {FUEL_LEVELS.map((level) => {
              const selected = fuel === level;
              const bars = FUEL_LEVEL_BARS[level];
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onFuelChange(level)}
                  className={cn(
                    "grid min-h-20 justify-items-center gap-2 rounded-xl p-2 ring-1 ring-foreground/10 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "bg-foreground text-background" : "bg-muted/40 hover:bg-muted"
                  )}
                >
                  <span className="flex h-8 items-end gap-0.5" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "w-2 rounded-sm",
                          i < bars ? (selected ? "bg-background" : "bg-foreground") : selected ? "bg-background/25" : "bg-foreground/15",
                          bars === 0 && i === 0 && "bg-status-serious"
                        )}
                        style={{ height: `${10 + i * 6}px` }}
                      />
                    ))}
                  </span>
                  <span className="text-sm font-medium">{FUEL_LEVEL_LABEL[level]}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* Fotos obligatorias */}
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid">
            <h3 className="font-semibold">Fotos obligatorias de recepción</h3>
            <p className="text-sm text-muted-foreground">
              {readyRequired}/{CHECK_IN_REQUIRED_SLOTS.length} listas · sin estas fotos no se puede crear la OT.
            </p>
          </div>
          {onAddSample && missing.length ? (
            <Button variant="outline" size="sm" onClick={() => missing.forEach((slot) => onAddSample(slot))}>
              <Sparkles data-icon="inline-start" />
              Completar con fotos de prueba
            </Button>
          ) : null}
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {CHECK_IN_REQUIRED_SLOTS.map((slot) => (
            <li key={slot}>
              <RequiredSlot slot={slot} item={photos.find((p) => p.slot === slot) ?? null} {...props} />
            </li>
          ))}
        </ul>
        {onAddSample ? (
          <p className="text-xs text-muted-foreground">
            Modo demo: puedes usar fotos de prueba en lugar de fotografiar una moto real.
          </p>
        ) : null}
      </div>

      {/* Daños preexistentes */}
      <div className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid">
            <h3 className="font-semibold">Daños preexistentes (opcional)</h3>
            <p className="text-sm text-muted-foreground">Rayones, golpes o piezas faltantes, con una nota rápida.</p>
          </div>
          <PhotoInputs slot="damage" onAddPhoto={props.onAddPhoto}>
            {(openCamera, openGallery) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="lg" className="h-10 px-3" onClick={openCamera}>
                  <Camera data-icon="inline-start" />
                  Fotografiar daño
                </Button>
                <Button variant="ghost" size="lg" className="h-10 px-3" onClick={openGallery}>
                  <ImagePlus data-icon="inline-start" />
                  Galería
                </Button>
                {onAddSample ? (
                  <Button variant="ghost" size="lg" className="h-10 px-3" onClick={() => onAddSample("damage", "Carenado rayado")}>
                    <Sparkles data-icon="inline-start" />
                    Daño de prueba
                  </Button>
                ) : null}
              </div>
            )}
          </PhotoInputs>
        </div>

        {damage.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Sin daños registrados. Si la moto llega con detalles, fotografíalos ahora: protege al taller y al cliente.
          </p>
        ) : (
          <ul className="grid gap-3">
            {damage.map((item) => (
              <li key={item.id} className="grid gap-3 rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5 sm:grid-cols-[8rem_1fr]">
                <PhotoPreview item={item} onRetry={props.onRetryPhoto} className="aspect-[4/3] sm:aspect-square" />
                <div className="grid content-start gap-2">
                  <div className="flex gap-2">
                    <Input
                      value={item.note}
                      onChange={(e) => props.onNoteChange(item.id, e.target.value)}
                      maxLength={120}
                      placeholder="Nota del daño (ej: Carenado rayado)"
                      aria-label="Nota del daño"
                      className="h-10"
                    />
                    <Button variant="ghost" size="icon-lg" onClick={() => props.onRemovePhoto(item.id)} aria-label="Quitar foto de daño">
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5" aria-label="Notas rápidas">
                    {DAMAGE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => props.onNoteChange(item.id, preset)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs ring-1 ring-foreground/10",
                          item.note === preset ? "bg-foreground text-background" : "bg-background hover:bg-muted"
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function RequiredSlot({
  slot,
  item,
  onAddPhoto,
  onAddSample,
  onRemovePhoto,
  onRetryPhoto,
}: Props & { slot: CheckInPhotoSlot; item: PhotoItem | null }) {
  const copy = CHECK_IN_SLOT_COPY[slot];
  return (
    <PhotoInputs slot={slot} onAddPhoto={onAddPhoto}>
      {(openCamera, openGallery) => (
        <div
          className={cn(
            "grid gap-2 rounded-xl bg-card p-3 ring-1 transition-colors",
            item?.status === "ready" ? "ring-status-good/40" : item?.status === "error" ? "ring-destructive/40" : "ring-foreground/10"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="grid min-w-0">
              <span className="truncate text-sm font-semibold">{copy.title}</span>
              <span className="truncate text-xs text-muted-foreground">{copy.hint}</span>
            </div>
            {item?.status === "ready" ? (
              <CircleCheck className="size-5 shrink-0 text-status-good" aria-label="Foto lista" />
            ) : (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">Obligatoria</span>
            )}
          </div>

          {item ? (
            <>
              <PhotoPreview item={item} onRetry={onRetryPhoto} className="aspect-[4/3]" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={openCamera}>
                  <Camera data-icon="inline-start" />
                  Repetir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onRemovePhoto(item.id)} aria-label={`Quitar foto: ${copy.title}`}>
                  <Trash2 />
                </Button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={openCamera}
                className="grid aspect-[4/3] place-content-center justify-items-center gap-2 rounded-lg border-2 border-dashed border-foreground/15 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
              >
                <Camera className="size-8" aria-hidden />
                Tomar foto
              </button>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" className="flex-1" onClick={openGallery}>
                  <ImagePlus data-icon="inline-start" />
                  Galería
                </Button>
                {onAddSample ? (
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => onAddSample(slot)}>
                    <Sparkles data-icon="inline-start" />
                    De prueba
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </PhotoInputs>
  );
}

function PhotoPreview({ item, onRetry, className }: { item: PhotoItem; onRetry: (id: string) => void; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) o foto de prueba */}
      <img src={item.preview} alt={CHECK_IN_SLOT_COPY[item.slot].title} className="size-full object-cover" />
      {item.status === "uploading" ? (
        <span className="absolute inset-0 grid place-content-center justify-items-center gap-1 bg-black/45 text-xs font-medium text-white">
          <LoaderCircle className="size-6 animate-spin" aria-hidden />
          Subiendo…
        </span>
      ) : item.status === "error" ? (
        <span className="absolute inset-0 grid place-content-center justify-items-center gap-2 bg-black/60 p-2 text-center text-xs text-white">
          <CircleAlert className="size-5" aria-hidden />
          {item.error ?? "No se pudo subir"}
          {item.file ? (
            <button
              type="button"
              onClick={() => onRetry(item.id)}
              className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 font-medium hover:bg-white/25"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Reintentar
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Inputs de archivo ocultos: cámara trasera (capture) y galería. Los hijos
 * reciben las funciones para abrirlos.
 */
function PhotoInputs({
  slot,
  onAddPhoto,
  children,
}: {
  slot: CheckInPhotoSlot;
  onAddPhoto: (slot: CheckInPhotoSlot, file: File) => void;
  children: (openCamera: () => void, openGallery: () => void) => React.ReactNode;
}) {
  const uid = useId();
  const cameraId = `${uid}-camera`;
  const galleryId = `${uid}-gallery`;
  const open = (inputId: string) => () => document.getElementById(inputId)?.click();
  const multiple = slot === "damage";

  function handle(files: FileList | null) {
    for (const file of Array.from(files ?? []).slice(0, multiple ? 8 : 1)) onAddPhoto(slot, file);
  }

  return (
    <>
      {children(open(cameraId), open(galleryId))}
      <input
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label={`Cámara: ${CHECK_IN_SLOT_COPY[slot].title}`}
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        id={galleryId}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-label={`Galería: ${CHECK_IN_SLOT_COPY[slot].title}`}
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
