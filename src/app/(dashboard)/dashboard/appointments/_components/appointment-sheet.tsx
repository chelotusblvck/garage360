"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Appointment } from "@/lib/appointments/types";
import { formatFullDate, toDateKey } from "@/lib/datetime";
import { AppointmentCard } from "./appointment-card";

/** Detalle de una cita al hacer clic en el calendario. */
export function AppointmentSheet({
  appointment,
  onClose,
}: {
  appointment: Appointment | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={appointment !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        {appointment ? (
          <>
            <SheetHeader className="border-b pr-12">
              <SheetTitle>Cita {appointment.code}</SheetTitle>
              <SheetDescription>{formatFullDate(toDateKey(new Date(appointment.starts_at)))}</SheetDescription>
            </SheetHeader>
            <div className="p-4">
              <AppointmentCard appointment={appointment} className="ring-0 p-0 sm:p-0" />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
