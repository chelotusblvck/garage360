"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Bike, CalendarPlus, Camera, Gauge, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { colorSwatch } from "@/lib/customers/shared";
import type { CustomerDetail, CustomerMotorcycle } from "@/lib/customers/types";
import { formatKm, formatPlate, formatRelativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MotorcycleFormSheet } from "./motorcycle-form-sheet";
import { PhotoGallery } from "./photo-gallery";
import { ServiceTimeline } from "./service-timeline";

/**
 * Vehículos, hoja de vida y evidencia fotográfica del cliente. Elegir una
 * moto filtra el historial y la galería; "Ver fotos" en una OT filtra la
 * galería por esa orden.
 */
export function CustomerWorkspace({ detail }: { detail: CustomerDetail }) {
  const [motoId, setMotoId] = useState<string | null>(detail.motorcycles.length === 1 ? detail.motorcycles[0].id : null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const galleryRef = useRef<HTMLElement>(null);

  // Si la moto elegida ya no existe (p. ej. tras refrescar), se muestran todas.
  const selectedMoto = detail.motorcycles.find((m) => m.id === motoId) ?? null;
  const history = selectedMoto ? detail.history.filter((o) => o.motorcycle_id === selectedMoto.id) : detail.history;
  const photos = selectedMoto ? detail.photos.filter((p) => p.motorcycle_id === selectedMoto.id) : detail.photos;
  const motoById = new Map(detail.motorcycles.map((m) => [m.id, m]));

  function selectMoto(id: string | null) {
    setMotoId(id);
    setOrderId(null);
  }

  function showOrderPhotos(id: string) {
    setOrderId(id);
    galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <section className="grid gap-3" aria-labelledby="vehicles-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="vehicles-title" className="text-lg font-semibold tracking-tight">
            Vehículos
          </h2>
          <div className="flex items-center gap-2">
            {detail.motorcycles.length > 1 ? (
              <Button variant={selectedMoto ? "outline" : "secondary"} size="sm" onClick={() => selectMoto(null)} aria-pressed={!selectedMoto}>
                Todas las motos
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus data-icon="inline-start" />
              Agregar moto
            </Button>
          </div>
        </div>

        {detail.motorcycles.length === 0 ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-sm text-muted-foreground hover:bg-muted/40"
          >
            <Bike className="size-6" aria-hidden />
            Este cliente aún no tiene motos. Agrega la primera.
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {detail.motorcycles.map((moto) => (
              <VehicleCard
                key={moto.id}
                moto={moto}
                selected={selectedMoto?.id === moto.id}
                selectable={detail.motorcycles.length > 1}
                onSelect={() => selectMoto(selectedMoto?.id === moto.id ? null : moto.id)}
              />
            ))}
          </div>
        )}
      </section>

      <PhotoGallery
        ref={galleryRef}
        photos={photos}
        orders={history}
        motoById={motoById}
        orderFilter={orderId}
        onClearOrderFilter={() => setOrderId(null)}
        scopeLabel={selectedMoto ? `${selectedMoto.brand} ${selectedMoto.model} · ${formatPlate(selectedMoto.plate)}` : null}
      />

      <ServiceTimeline
        records={history}
        motoById={motoById}
        showMoto={!selectedMoto && detail.motorcycles.length > 1}
        scopeLabel={selectedMoto ? `${selectedMoto.brand} ${selectedMoto.model}` : null}
        onShowPhotos={showOrderPhotos}
      />

      <MotorcycleFormSheet open={addOpen} onOpenChange={setAddOpen} customerId={detail.customer.id} />
    </>
  );
}

function VehicleCard({
  moto,
  selected,
  selectable,
  onSelect,
}: {
  moto: CustomerMotorcycle;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
}) {
  const swatch = colorSwatch(moto.color);
  return (
    <article
      className={cn(
        "relative grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow",
        selected && selectable && "ring-2 ring-primary"
      )}
    >
      {selectable ? (
        // Botón que cubre la tarjeta: selecciona la moto para filtrar historial y fotos.
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`Filtrar historial y fotos por ${moto.brand} ${moto.model} ${formatPlate(moto.plate)}`}
          className="absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{moto.brand}</p>
          <p className="truncate text-base font-semibold">{moto.model}</p>
          <p className="text-sm text-muted-foreground">
            Año {moto.year}
            {moto.color ? (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1.5">
                  {swatch ? (
                    <span className="size-3 rounded-full ring-1 ring-foreground/20" style={{ backgroundColor: swatch }} aria-hidden />
                  ) : null}
                  {moto.color}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <span className="shrink-0 rounded border-2 border-foreground/80 bg-background px-1.5 py-0.5 font-mono text-sm font-semibold tracking-wider">
          {formatPlate(moto.plate)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="flex items-center gap-1 text-xs text-muted-foreground">
            <Gauge className="size-3" aria-hidden /> Kilometraje
          </dt>
          <dd className="font-medium tabular-nums">{formatKm(moto.current_km)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Última visita</dt>
          <dd>
            {moto.last_visit_at ? formatRelativeDays(new Date(moto.last_visit_at)) : "Sin visitas"}
            {moto.order_count ? <span className="text-muted-foreground"> · {moto.order_count} OT</span> : null}
          </dd>
        </div>
      </dl>

      {moto.notes ? <p className="rounded-lg bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">{moto.notes}</p> : null}

      {/* z-10: por encima del botón de selección de la tarjeta. */}
      <div className="relative z-10 flex gap-2">
        <Link
          href={`/dashboard/orders/new?plate=${moto.plate}`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1" })}
        >
          <Camera data-icon="inline-start" />
          Recepcionar
        </Link>
        <Link
          href={`/dashboard/appointments?new=1&plate=${moto.plate}`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1" })}
        >
          <CalendarPlus data-icon="inline-start" />
          Agendar
        </Link>
      </div>
    </article>
  );
}
