import Link from "next/link";
import { AppointmentStatusBadge, ServiceTypeBadge } from "@/components/appointments/badges";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPlate } from "@/lib/format";
import type { TodayAppointment } from "@/lib/data/metrics";

export function TodayAppointments({
  appointments,
  dateLabel,
}: {
  appointments: TodayAppointment[];
  dateLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda de hoy</CardTitle>
        <CardDescription className="first-letter:uppercase">{dateLabel}</CardDescription>
        <CardAction>
          <Link href="/dashboard/appointments?view=list" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ver agenda
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No hay citas agendadas para hoy.</p>
        ) : (
          <ol className="divide-y">
            {appointments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <time className="w-12 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{a.time}</time>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.clientName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.motorcycle} · <span className="font-mono">{formatPlate(a.plate)}</span>
                  </p>
                </div>
                <ServiceTypeBadge service={a.serviceType} className="hidden sm:inline-flex" />
                {a.workOrderId ? (
                  <Link href={`/dashboard/orders/${a.workOrderId}`} className="shrink-0 hover:opacity-80">
                    <AppointmentStatusBadge status={a.status} />
                  </Link>
                ) : (
                  <AppointmentStatusBadge status={a.status} className="shrink-0" />
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
