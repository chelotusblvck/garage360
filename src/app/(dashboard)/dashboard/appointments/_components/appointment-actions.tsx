"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  Camera,
  ClipboardList,
  EllipsisVertical,
  LoaderCircle,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import {
  rescheduleAppointment,
  updateAppointmentStatus,
} from "@/app/actions/appointments";
import { SlotPicker } from "@/components/appointments/slot-picker";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Appointment } from "@/lib/appointments/types";
import { canConvertToWorkOrder, canReschedule } from "@/lib/appointments/workflow";
import { formatFullDate, toDateKey, toTimeKey } from "@/lib/datetime";
import { formatPlate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/validations/schemas";

type Props = {
  appointment: Appointment;
  /** Ancho completo (hoja de detalle) o compacto (tarjeta de lista). */
  layout?: "inline" | "stacked";
  onDone?: () => void;
};

export function AppointmentActions({ appointment: a, layout = "inline", onDone }: Props) {
  const [confirm, confirmDialog] = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"reschedule" | null>(null);

  function setStatus(status: AppointmentStatus, message: string) {
    startTransition(async () => {
      const result = await updateAppointmentStatus(a.id, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      onDone?.();
    });
  }

  async function cancel() {
    const ok = await confirm({
      title: `¿Cancelar la cita ${a.code}?`,
      description: "El horario queda libre para otra reserva. Podrás reactivarla reagendándola.",
      confirmLabel: "Cancelar cita",
      destructive: true,
    });
    if (ok) setStatus("cancelled", `Cita ${a.code} cancelada`);
  }

  async function noShow() {
    const ok = await confirm({
      title: "¿Marcar como «No asistió»?",
      description: `${a.contact.name ?? a.customer.name} no se presentó a la cita ${a.code}.`,
      confirmLabel: "Marcar ausencia",
      destructive: true,
    });
    if (ok) setStatus("no_show", `Cita ${a.code}: no asistió`);
  }

  const wrap = cn("flex flex-wrap items-center gap-2", layout === "stacked" && "grid grid-cols-2");

  if (a.status === "completed") {
    return a.work_order ? (
      <div className={wrap}>
        <Link href={`/dashboard/orders/${a.work_order.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ClipboardList data-icon="inline-start" />
          Ver {a.work_order.folio}
        </Link>
      </div>
    ) : null;
  }

  const menuItems = [
    canReschedule(a.status) && a.status !== "cancelled" && a.status !== "no_show"
      ? { key: "reschedule", label: "Reagendar", icon: CalendarClock, run: () => setDialog("reschedule") }
      : null,
    a.status === "scheduled" || a.status === "confirmed"
      ? { key: "no_show", label: "No asistió", icon: UserX, run: noShow }
      : null,
    a.status === "scheduled" || a.status === "confirmed"
      ? { key: "cancel", label: "Cancelar cita", icon: Ban, run: cancel, destructive: true }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <>
      <div className={wrap}>
        {a.status === "scheduled" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setStatus("confirmed", `Cita ${a.code} confirmada`)}
          >
            {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <CalendarCheck data-icon="inline-start" />}
            Confirmar
          </Button>
        ) : null}

        {canConvertToWorkOrder(a.status) ? (
          // La OT nace en la recepción con fotos obligatorias (asistente de check-in).
          <Link href={`/dashboard/orders/new?appointment=${a.id}`} className={buttonVariants({ size: "sm" })}>
            <Camera data-icon="inline-start" />
            Recepcionar
          </Link>
        ) : null}

        {a.status === "cancelled" || a.status === "no_show" ? (
          <Button variant="outline" size="sm" onClick={() => setDialog("reschedule")}>
            <CalendarClock data-icon="inline-start" />
            Reagendar
          </Button>
        ) : null}

        {menuItems.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={`Más acciones para ${a.code}`} disabled={isPending} />}
            >
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {menuItems.map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  onClick={item.run}
                  variant={"destructive" in item && item.destructive ? "destructive" : "default"}
                >
                  <item.icon />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {confirmDialog}
      <RescheduleDialog
        appointment={a}
        open={dialog === "reschedule"}
        onOpenChange={(open) => setDialog(open ? "reschedule" : null)}
        onDone={onDone}
      />
    </>
  );
}

function RescheduleDialog({
  appointment: a,
  open,
  onOpenChange,
  onDone,
}: {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const current = new Date(a.starts_at);

  function submit() {
    if (!date || !time) return;
    startTransition(async () => {
      const result = await rescheduleAppointment(a.id, date, time);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Cita ${a.code} reagendada: ${formatFullDate(date)}, ${time} h`);
      onOpenChange(false);
      setDate(null);
      setTime(null);
      onDone?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Reagendar cita {a.code}</DialogTitle>
          <DialogDescription>
            Actual: {formatFullDate(toDateKey(current))}, {toTimeKey(current)} h · {a.motorcycle.brand} {a.motorcycle.model}{" "}
            ({formatPlate(a.motorcycle.plate)})
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <SlotPicker
            service={a.service_type}
            date={date}
            time={time}
            onChange={(d, t) => {
              setDate(d);
              setTime(t);
            }}
            excludeAppointmentId={a.id}
          />
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button onClick={submit} disabled={!date || !time || isPending}>
            {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
            Reagendar {date && time ? `al ${formatFullDate(date).split(",")[0].toLowerCase()} ${time}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
