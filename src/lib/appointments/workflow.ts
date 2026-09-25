import type { AppointmentStatus } from "@/lib/validations/schemas";

/*
 * Estados de la cita. Refleja appointment_transition_allowed() en SQL.
 *   Por confirmar → Confirmada → Atendida (al convertir en OT)
 *   Por confirmar / Confirmada → Cancelada | No asistió
 *   Cancelada / No asistió → se reactivan solo al reagendar
 */

export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["scheduled", "confirmed"];

export const isActiveAppointment = (s: AppointmentStatus) => ACTIVE_APPOINTMENT_STATUSES.includes(s);

/** Transiciones disponibles por cambio de estado directo (no incluye reagendar). */
export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  if (from === "scheduled") return ["confirmed", "completed", "cancelled", "no_show"].includes(to);
  if (from === "confirmed") return ["completed", "cancelled", "no_show"].includes(to);
  return false;
}

export const canConvertToWorkOrder = (s: AppointmentStatus) => isActiveAppointment(s);
export const canReschedule = (s: AppointmentStatus) => s !== "completed";

export const formatBookingCode = (code: string | null) => (code ? `MO-${code}` : "—");
