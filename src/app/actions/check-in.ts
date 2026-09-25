"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { getAppointmentRepository } from "@/lib/appointments/repository";
import { AppointmentError, type Appointment } from "@/lib/appointments/types";
import { denyStaffWrite, requireStaff } from "@/lib/auth";
import { getCheckInRepository } from "@/lib/checkin/repository";
import { checkInCaption } from "@/lib/checkin/shared";
import { CheckInError, type CheckInResult } from "@/lib/checkin/types";
import { addDays, todayKey, zonedToUtc } from "@/lib/datetime";
import { WorkOrderError } from "@/lib/orders/types";
import {
  checkInSchema,
  walkInVehicleSchema,
  WORK_ORDER_PHOTO_MAX_BYTES,
  WORK_ORDER_PHOTO_TYPES,
} from "@/lib/validations/schemas";

/*
 * Recepción de motos (check-in). Es la ÚNICA forma de crear una OT: exige
 * las fotos de ingreso (tablero, costado izquierdo y derecho) y crea la OT,
 * cierra la cita de origen y asocia las fotos en un solo paso.
 */

const idSchema = z.uuid("Identificador inválido");

function handleError<T>(error: unknown): ActionResult<T> {
  if (error instanceof CheckInError || error instanceof WorkOrderError || error instanceof AppointmentError) {
    return failure(error.message, error.field ? { [error.field]: [error.message] } : undefined);
  }
  console.error("[check-in action]", error);
  return failure("Ocurrió un error inesperado. Intenta de nuevo.");
}

/**
 * Citas de hoy pendientes de recepción (agendadas o confirmadas, sin OT).
 * `includeId` agrega una cita puntual de otro día (enlace "Recepcionar").
 */
export async function getCheckInAppointments(includeId?: string | null): Promise<Appointment[]> {
  await requireStaff();
  const repo = getAppointmentRepository();
  const today = todayKey();
  const list = await repo.list({
    from: zonedToUtc(today).toISOString(),
    to: zonedToUtc(addDays(today, 1)).toISOString(),
    status: "all",
    service: "all",
  });

  const extraId = idSchema.safeParse(includeId);
  if (extraId.success && !list.some((a) => a.id === extraId.data)) {
    const extra = await repo.get(extraId.data);
    if (extra) list.push(extra);
  }

  return list
    .filter((a) => (a.status === "scheduled" || a.status === "confirmed") && !a.work_order)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Sube una foto de recepción (ya comprimida en el navegador) antes de crear la OT. */
export async function stageCheckInPhoto(file: File): Promise<ActionResult<{ token: string }>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  if (!(file instanceof File) || file.size === 0) return failure("Selecciona una imagen");
  if (!(WORK_ORDER_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return failure("Formato no soportado (JPG, PNG, WebP o AVIF)");
  }
  if (file.size > WORK_ORDER_PHOTO_MAX_BYTES) return failure("La imagen supera los 5 MB");

  try {
    return success({ token: await getCheckInRepository().stagePhoto(file) });
  } catch (error) {
    return handleError(error);
  }
}

/** Confirma la recepción: crea la OT "Recepcionada" con sus fotos de ingreso. */
export async function completeCheckIn(data: unknown): Promise<ActionResult<CheckInResult>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsed = checkInSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);
  const input = parsed.data;

  let vehicle = null;
  if (input.source === "walk_in") {
    const parsedVehicle = walkInVehicleSchema.safeParse(input.vehicle);
    if (!parsedVehicle.success) return validationFailure(parsedVehicle.error);
    vehicle = parsedVehicle.data;
  }

  try {
    const result = await getCheckInRepository().complete({
      appointment_id: input.source === "appointment" ? input.appointment_id : null,
      vehicle,
      km: input.km,
      fuel_level: input.fuel_level,
      intake_reason: input.intake_reason,
      mechanic_id: input.mechanic_id,
      photos: input.photos.map((p) => ({ ...p, caption: checkInCaption(p.slot, p.note) })),
    });
    revalidatePath("/dashboard", "layout");
    return success(result);
  } catch (error) {
    return handleError(error);
  }
}
