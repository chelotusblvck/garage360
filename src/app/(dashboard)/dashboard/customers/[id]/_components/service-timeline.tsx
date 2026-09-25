import Link from "next/link";
import { Camera, Gauge, HardHat, History } from "lucide-react";
import { WORK_ORDER_STATUS_STYLE, WorkOrderStatusBadge } from "@/components/orders/work-order-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerMotorcycle, ServiceRecord } from "@/lib/customers/types";
import { formatCurrency, formatDate, formatKm, formatPlate, formatRelativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  records: ServiceRecord[];
  motoById: Map<string, CustomerMotorcycle>;
  showMoto: boolean;
  scopeLabel: string | null;
  onShowPhotos: (orderId: string) => void;
};

/** Hoja de vida: una entrada por OT, de la más reciente a la más antigua. */
export function ServiceTimeline({ records, motoById, showMoto, scopeLabel, onShowPhotos }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" aria-hidden />
          Hoja de vida
        </CardTitle>
        <CardDescription>
          {scopeLabel ? `${scopeLabel}: ` : ""}mantenimientos, reparaciones, inspecciones y kilometraje registrado en cada ingreso.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ingresos al taller todavía.</p>
        ) : (
          <ol className="relative grid gap-5 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-border">
            {records.map((record) => {
              const moto = motoById.get(record.motorcycle_id);
              const closedAt = record.delivered_at ?? record.completed_at;
              return (
                <li key={record.id} className="relative grid gap-2 pl-7">
                  <span
                    className={cn(
                      "absolute top-1.5 left-0 size-[15px] rounded-full ring-4 ring-card",
                      WORK_ORDER_STATUS_STYLE[record.status].accentClass
                    )}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <time dateTime={record.created_at} className="text-sm font-medium tabular-nums">
                      {formatDate(new Date(record.created_at))}
                    </time>
                    <span className="text-xs text-muted-foreground">{formatRelativeDays(new Date(record.created_at))}</span>
                    <Link
                      href={`/dashboard/orders/${record.id}`}
                      className="font-mono text-sm font-semibold hover:underline hover:underline-offset-4"
                    >
                      {record.folio}
                    </Link>
                    <WorkOrderStatusBadge status={record.status} />
                  </div>

                  <div className="grid gap-1.5 rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {showMoto && moto ? (
                        <span className="text-foreground">
                          {moto.brand} {moto.model} · <span className="font-mono">{formatPlate(moto.plate)}</span>
                        </span>
                      ) : null}
                      {record.km_at_intake !== null ? (
                        <span className="inline-flex items-center gap-1">
                          <Gauge className="size-3" aria-hidden />
                          {formatKm(record.km_at_intake)}
                        </span>
                      ) : null}
                      {record.mechanic_name ? (
                        <span className="inline-flex items-center gap-1">
                          <HardHat className="size-3" aria-hidden />
                          {record.mechanic_name}
                        </span>
                      ) : null}
                      {closedAt ? <span>Cerrada el {formatDate(new Date(closedAt))}</span> : null}
                    </p>
                    <p className="text-sm">{record.intake_reason}</p>
                    {record.diagnosis ? <p className="text-sm text-muted-foreground">{record.diagnosis}</p> : null}
                    {record.jobs.length ? (
                      <ul className="flex flex-wrap gap-1.5" aria-label="Trabajos realizados">
                        {record.jobs.map((job, i) => (
                          <li key={i} className="rounded-md bg-background px-2 py-0.5 text-xs ring-1 ring-foreground/10">
                            {job}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between gap-3">
                      {record.photo_count > 0 ? (
                        <button
                          type="button"
                          onClick={() => onShowPhotos(record.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:underline hover:underline-offset-4"
                        >
                          <Camera className="size-3.5" aria-hidden />
                          Ver {record.photo_count === 1 ? "1 foto" : `${record.photo_count} fotos`}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin fotos</span>
                      )}
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(record.total_amount)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
