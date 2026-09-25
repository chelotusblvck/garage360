"use client";

import { Globe, Phone } from "lucide-react";
import { AppointmentStatusBadge, ServiceTypeBadge } from "@/components/appointments/badges";
import { formatPlate } from "@/lib/format";
import type { Appointment } from "@/lib/appointments/types";
import { toTimeKey } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { AppointmentActions } from "./appointment-actions";

export function AppointmentCard({
  appointment: a,
  className,
}: {
  appointment: Appointment;
  className?: string;
}) {
  const phone = a.contact.phone ?? a.customer.phone;
  const inactive = a.status === "cancelled" || a.status === "no_show";

  return (
    <article
      className={cn(
        "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:p-4",
        className
      )}
      aria-label={`${toTimeKey(new Date(a.starts_at))} ${formatPlate(a.motorcycle.plate)} ${a.customer.name}`}
    >
      <div className={cn("grid content-start gap-0.5", inactive && "opacity-60")}>
        <time dateTime={a.starts_at} className="font-mono text-lg leading-none font-semibold tabular-nums">
          {toTimeKey(new Date(a.starts_at))}
        </time>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">a {toTimeKey(new Date(a.ends_at))}</span>
      </div>

      <div className="grid min-w-0 gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <AppointmentStatusBadge status={a.status} />
          <ServiceTypeBadge service={a.service_type} />
          <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
          {a.source === "public" ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Reservada desde la web">
              <Globe className="size-3" aria-hidden /> Web
            </span>
          ) : null}
        </div>

        <div className={cn("grid gap-0.5", inactive && "opacity-60")}>
          <p className="flex flex-wrap items-center gap-x-2 font-medium">
            <span className="truncate">
              {a.motorcycle.brand} {a.motorcycle.model}
            </span>
            <span className="rounded border bg-muted/60 px-1.5 font-mono text-xs tracking-wide">{formatPlate(a.motorcycle.plate)}</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="text-foreground">{a.contact.name ?? a.customer.name}</span>
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                <Phone className="size-3" aria-hidden />
                {phone}
              </a>
            ) : null}
          </p>
          {a.notes ? <p className="line-clamp-2 text-sm text-muted-foreground">{a.notes}</p> : null}
        </div>

        <AppointmentActions appointment={a} />
      </div>
    </article>
  );
}
