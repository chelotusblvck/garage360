"use client";

import { useState, type Ref } from "react";
import { Camera, ImageOff, Images, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PHOTO_STAGE_LABEL, PHOTO_STAGE_SHORT, PHOTO_STAGES } from "@/lib/customers/shared";
import type { CustomerMotorcycle, ServiceRecord, WorkOrderPhoto } from "@/lib/customers/types";
import { formatDateTime, formatPlate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PhotoStage } from "@/lib/validations/schemas";
import { PhotoLightbox } from "@/components/photos/photo-lightbox";
import { PhotoUploadDialog } from "./photo-upload-dialog";

type Props = {
  ref?: Ref<HTMLElement>;
  photos: WorkOrderPhoto[];
  orders: ServiceRecord[];
  motoById: Map<string, CustomerMotorcycle>;
  /** OT elegida desde la hoja de vida ("Ver fotos"). */
  orderFilter: string | null;
  onClearOrderFilter: () => void;
  scopeLabel: string | null;
};

/** Evidencia fotográfica: pestañas por etapa, grilla, visor HD y carga. */
export function PhotoGallery({ ref, photos, orders, motoById, orderFilter, onClearOrderFilter, scopeLabel }: Props) {
  const [stage, setStage] = useState<PhotoStage>("reception");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const scoped = orderFilter ? photos.filter((p) => p.work_order_id === orderFilter) : photos;
  const counts = Object.fromEntries(
    PHOTO_STAGES.map((s) => [s, scoped.filter((p) => p.stage === s).length])
  ) as Record<PhotoStage, number>;

  // Al filtrar por una OT, abre la primera etapa que tenga fotos (ajuste
  // durante el render en vez de un efecto: https://react.dev/learn/you-might-not-need-an-effect).
  const [lastOrderFilter, setLastOrderFilter] = useState(orderFilter);
  if (orderFilter !== lastOrderFilter) {
    setLastOrderFilter(orderFilter);
    const firstWithPhotos = PHOTO_STAGES.find((s) => counts[s] > 0);
    if (orderFilter && firstWithPhotos) setStage(firstWithPhotos);
  }

  const visible = scoped.filter((p) => p.stage === stage).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const filterOrder = orderFilter ? orders.find((o) => o.id === orderFilter) : null;
  const uploadable = orders.filter((o) => o.status !== "cancelled");

  return (
    <section ref={ref} className="grid scroll-mt-20 gap-3" aria-labelledby="gallery-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 id="gallery-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Images className="size-5 text-muted-foreground" aria-hidden />
            Evidencia fotográfica
          </h2>
          <p className="text-sm text-muted-foreground">
            {scopeLabel ? `${scopeLabel} · ` : ""}Inspección de ingreso, avance del trabajo y estado de entrega.
          </p>
        </div>
        <Button size="lg" className="h-9 px-3" onClick={() => setUploadOpen(true)} disabled={uploadable.length === 0}>
          <Camera data-icon="inline-start" />
          Subir fotos
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Etapa de la inspección" className="inline-flex rounded-lg bg-muted p-0.5">
          {PHOTO_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              id={`photos-tab-${s}`}
              aria-selected={stage === s}
              aria-controls="photos-panel"
              onClick={() => setStage(s)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                stage === s && "bg-background text-foreground shadow-xs ring-1 ring-foreground/10"
              )}
            >
              <span className="sm:hidden">{PHOTO_STAGE_SHORT[s]}</span>
              <span className="hidden sm:inline">{PHOTO_STAGE_LABEL[s]}</span>
              <span className="text-xs tabular-nums opacity-60">{counts[s]}</span>
            </button>
          ))}
        </div>
        {filterOrder ? (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-card pr-1 pl-3 text-sm ring-1 ring-foreground/10">
            Solo <span className="font-mono font-medium">{filterOrder.folio}</span>
            <button
              type="button"
              onClick={onClearOrderFilter}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Ver fotos de todas las órdenes"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ) : null}
      </div>

      <div id="photos-panel" role="tabpanel" aria-labelledby={`photos-tab-${stage}`}>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
            <ImageOff className="size-6" aria-hidden />
            <p>Sin fotos de {PHOTO_STAGE_SHORT[stage].toLowerCase()}{filterOrder ? ` en ${filterOrder.folio}` : ""}.</p>
            {uploadable.length ? (
              <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                Subir fotos
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((photo, index) => {
              const moto = motoById.get(photo.motorcycle_id);
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="group grid w-full gap-1.5 text-left outline-none"
                    aria-label={`Ampliar foto: ${photo.caption ?? PHOTO_STAGE_SHORT[photo.stage]} (${photo.folio})`}
                  >
                    <span className="relative block aspect-[3/2] overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
                      {/* eslint-disable-next-line @next/next/no-img-element -- URLs firmadas de Storage o data URLs (demo) */}
                      <img
                        src={photo.url}
                        alt={photo.caption ?? `Foto de ${PHOTO_STAGE_SHORT[photo.stage].toLowerCase()}`}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">
                        {photo.folio}
                      </span>
                    </span>
                    <span className="grid gap-0.5">
                      <span className="line-clamp-2 text-sm leading-snug">{photo.caption ?? "Sin descripción"}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {formatDateTime(new Date(photo.created_at))}
                        {moto ? ` · ${formatPlate(moto.plate)}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <PhotoLightbox
        photos={visible}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        motoById={motoById}
      />
      <PhotoUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        orders={uploadable}
        motoById={motoById}
        defaultOrderId={orderFilter}
        defaultStage={stage}
        onUploaded={(uploadedStage) => setStage(uploadedStage)}
      />
    </section>
  );
}
