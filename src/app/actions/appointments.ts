"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { PUBLIC_MIN_LEAD_MINUTES, SERVICE_DURATION, computeSlots, type Slot } from "@/lib/appointments/schedule";
import { getAppointmentRepository } from "@/lib/appointments/repository";
import {
  AppointmentError,
  type Appointment,
  type BookingResult,
  type DaySummary,
} from "@/lib/appointments/types";
import { READ_ONLY_MESSAGE, denyStaffWrite, getCurrentProfile, requireStaff } from "@/lib/auth";
import { addDays, todayKey, zonedToUtc } from "@/lib/datetime";
import {
  appointmentFiltersSchema,
  appointmentStatusSchema,
  bookingSchema,
  dateKeySchema,
  rescheduleSchema,
  serviceTypeSchema,
  type AppointmentStatus,
  type ServiceType,
} from "@/lib/validations/schemas";

const idSchema = z.uuid("Identificador inválido");

function revalidateAgenda() {
  revalidatePath("/dashboard", "layout");
}

function handleError<T>(error: unknown): ActionResult<T> {
  if (error instanceof AppointmentError) {
    return failure(error.message, error.field ? { [error.field]: [error.message] } : undefined);
  }
  console.error("[appointments action]", error);
  return failure("Ocurrió un error inesperado. Intenta de nuevo.");
}

/** Días locales [from, to] → instantes UTC [inicio de from, inicio de to+1). */
function dayRange(from: string, to: string) {
  return {
    from: zonedToUtc(from).toISOString(),
    to: zonedToUtc(addDays(to, 1)).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

/** Citas por rango de fechas (días locales), estado y tipo de servicio. */
export async function getAppointments(filters: unknown): Promise<Appointment[]> {
  await requireStaff();
  const parsed = appointmentFiltersSchema.parse(filters);
  return getAppointmentRepository().list({
    ...dayRange(parsed.from, parsed.to),
    status: parsed.status,
    service: parsed.service,
  });
}

/** Indicadores rápidos de un día (por defecto, hoy). */
export async function getAppointmentDaySummary(date?: string): Promise<DaySummary> {
  await requireStaff();
  const day = dateKeySchema.safeParse(date).success ? date! : todayKey();
  const appointments = await getAppointmentRepository().list({ ...dayRange(day, day), status: "all", service: "all" });
  const now = Date.now();
  const active = appointments.filter((a) => a.status === "scheduled" || a.status === "confirmed");

  return {
    date: day,
    total: appointments.filter((a) => a.status !== "cancelled").length,
    scheduled: appointments.filter((a) => a.status === "scheduled").length,
    confirmed: appointments.filter((a) => a.status === "confirmed").length,
    maintenance: appointments.filter((a) => a.service_type === "maintenance" && a.status !== "cancelled").length,
    next: active.find((a) => new Date(a.ends_at).getTime() > now) ?? null,
  };
}

/**
 * Horarios de un día con disponibilidad. Público (agenda web); con
 * `excludeAppointmentId` (reagendar) requiere staff.
 */
export async function getAvailableSlots(
  date: string,
  service: ServiceType,
  excludeAppointmentId?: string
): Promise<Slot[]> {
  const day = dateKeySchema.safeParse(date);
  const svc = serviceTypeSchema.safeParse(service);
  if (!day.success || !svc.success) return [];
  if (excludeAppointmentId) {
    await requireStaff();
    if (!idSchema.safeParse(excludeAppointmentId).success) return [];
  }

  const { from, to } = dayRange(day.data, day.data);
  const busy = await getAppointmentRepository().busy(from, to, excludeAppointmentId);
  return computeSlots({
    date: day.data,
    minutes: SERVICE_DURATION[svc.data],
    busy,
    minLeadMinutes: excludeAppointmentId ? 0 : PUBLIC_MIN_LEAD_MINUTES,
  });
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------

/**
 * Agendamiento interno (staff) o público (agenda web, sin autenticación).
 * El canal "public" nunca obtiene privilegios de staff, aunque haya sesión.
 */
export async function createAppointment(
  data: unknown,
  channel: "staff" | "public" = "staff"
): Promise<ActionResult<BookingResult>> {
  const profile = await getCurrentProfile();
  if (channel === "staff" && profile?.support) return failure(READ_ONLY_MESSAGE);
  const isStaff = channel === "staff" && (profile?.role === "admin" || profile?.role === "mechanic");
  if (channel === "staff" && !isStaff) return failure("No autorizado");

  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);
  if (parsed.data.website) return failure("No se pudo procesar la reserva"); // honeypot

  const input = isStaff ? parsed.data : { ...parsed.data, motorcycle_id: null };
  const startsAt = zonedToUtc(input.date, input.time);

  try {
    const result = await getAppointmentRepository().book(input, startsAt, isStaff);
    revalidateAgenda();
    return success(result);
  } catch (error) {
    return handleError(error);
  }
}

/** Confirmar, cancelar o marcar ausencia. (Reactivar = reagendar.) */
export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<ActionResult<null>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsedId = idSchema.safeParse(id);
  const parsedStatus = appointmentStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return failure("Datos inválidos");
  if (parsedStatus.data === "scheduled") return failure("Para reactivar una cita, reagéndala");

  try {
    await getAppointmentRepository().updateStatus(parsedId.data, parsedStatus.data);
    revalidateAgenda();
    return success(null);
  } catch (error) {
    return handleError(error);
  }
}

export async function rescheduleAppointment(id: string, date: string, time: string): Promise<ActionResult<null>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return failure("Cita inválida");
  const parsed = rescheduleSchema.safeParse({ date, time });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await getAppointmentRepository().reschedule(parsedId.data, zonedToUtc(parsed.data.date, parsed.data.time));
    revalidateAgenda();
    return success(null);
  } catch (error) {
    return handleError(error);
  }
}

// La conversión de una cita en OT pasa por la recepción (actions/check-in.ts),
// que exige las fotos de ingreso.
