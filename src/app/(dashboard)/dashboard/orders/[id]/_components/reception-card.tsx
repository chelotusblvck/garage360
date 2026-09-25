"use client";

import { useState } from "react";
import { Camera, Gauge, Images } from "lucide-react";
import { FuelGauge } from "@/components/orders/fuel-gauge";
import { PhotoLightbox } from "@/components/photos/photo-lightbox";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PHOTO_STAGE_SHORT } from "@/lib/customers/shared";
import type { WorkOrderPhoto } from "@/lib/customers/types";
import { formatKm } from "@/lib/format";
import type { FuelLevel } from "@/lib/validations/schemas";

/** Estado de ingreso (km, combustible) y evidencia fotográfica de la OT. */
export function ReceptionCard({
  photos,
  km,
  fuel,
}: {
  photos: WorkOrderPhoto[];
  km: number | null;
  fuel: FuelLevel | null;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const reception = photos.filter((p) => p.stage === "reception").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="size-4 text-muted-foreground" aria-hidden />
          Registro de recepción
        </CardTitle>
        <CardDescription>
          {reception} {reception === 1 ? "foto" : "fotos"} de ingreso
          {photos.length > reception ? ` · ${photos.length - reception} de proceso / entrega` : ""}
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-4 text-sm">
          {km !== null ? (
            <span className="inline-flex items-center gap-1.5">
              <Gauge className="size-4 text-muted-foreground" aria-hidden />
              {formatKm(km)}
            </span>
          ) : null}
          {fuel ? <FuelGauge level={fuel} /> : null}
        </CardAction>
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Images className="size-4" aria-hidden />
            Esta orden no tiene fotos registradas.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
            {photos.map((photo, i) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  className="group grid w-full gap-1 text-left outline-none"
                  aria-label={`Ampliar: ${photo.caption ?? PHOTO_STAGE_SHORT[photo.stage]}`}
                >
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10 group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URLs firmadas de Storage o data URLs (demo) */}
                    <img src={photo.url} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-[1.03]" />
                    {photo.stage !== "reception" ? (
                      <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                        {PHOTO_STAGE_SHORT[photo.stage]}
                      </span>
                    ) : null}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{photo.caption ?? PHOTO_STAGE_SHORT[photo.stage]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <PhotoLightbox photos={photos} index={index} onIndexChange={setIndex} />
    </Card>
  );
}
