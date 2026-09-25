import "server-only";
import { logActionError } from "@/lib/logger";
import type { PostgrestError } from "@supabase/supabase-js";
import { formatFolio } from "@/lib/orders/workflow";
import { createClient } from "@/lib/supabase/server";
import { CheckInError, type CheckInRepository } from "./types";

/** Mismo bucket privado que el resto de la evidencia fotográfica. */
const BUCKET = "work-order-photos";
/** Las fotos del check-in se suben aquí antes de que exista la OT. */
const STAGING_PATH = /^checkin\/[0-9a-f-]{36}\.(webp|jpeg|png|avif)$/;

function fail(error: PostgrestError): never {
  const msg = error.message ?? "";
  if (error.code === "23505") {
    if (msg.includes("motorcycles_plate_unique")) throw new CheckInError("Ya existe una moto con esa patente", "plate");
    if (msg.includes("motorcycles_vin_unique")) throw new CheckInError("Ya existe una moto con ese VIN", "vin");
    if (msg.includes("customers_email_unique")) throw new CheckInError("Ya existe un cliente con ese email", "customer_email");
  }
  if (error.code === "42501") throw new CheckInError("No tienes permisos para esta operación");
  // Errores de negocio de check_in_work_order() y las funciones que llama.
  if (["22023", "55000", "P0002"].includes(error.code)) {
    const field = msg.includes("kilometraje") ? "km" : msg.includes("foto") ? "photos" : msg.includes("cita") ? "appointment_id" : undefined;
    throw new CheckInError(msg, field);
  }
  logActionError("check-in · Supabase", error);
  throw new CheckInError("No se pudo completar la recepción. Intenta de nuevo.");
}

export const supabaseCheckInRepository: CheckInRepository = {
  async stagePhoto(file) {
    const supabase = await createClient();
    const ext = file.type.split("/")[1] ?? "webp";
    const path = `checkin/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      logActionError("check-in · Storage", error);
      throw new CheckInError("No se pudo subir la foto", "photos");
    }
    return path;
  },

  async complete(command) {
    if (command.photos.some((p) => !STAGING_PATH.test(p.token))) {
      throw new CheckInError("Foto de recepción inválida. Vuelve a tomarla.", "photos");
    }
    const supabase = await createClient();
    const vehicle = command.vehicle;
    const isNewMoto = vehicle?.motorcycle_mode === "new";
    const isNewCustomer = isNewMoto && vehicle?.customer_mode === "new";

    // Una transacción: crea/convierte la OT, registra combustible y asocia las fotos.
    const { data, error } = await supabase.rpc("check_in_work_order", {
      p_intake_reason: command.intake_reason,
      p_km: command.km,
      p_fuel_level: command.fuel_level,
      p_photos: command.photos.map((p) => ({ path: p.token, slot: p.slot, caption: p.caption })),
      p_appointment_id: command.appointment_id,
      p_mechanic_id: command.mechanic_id,
      p_motorcycle_id: vehicle && !isNewMoto ? vehicle.motorcycle_id : null,
      p_customer_id: vehicle && isNewMoto && !isNewCustomer ? vehicle.customer_id : null,
      p_customer_name: isNewCustomer ? vehicle.customer_name : null,
      p_customer_phone: isNewCustomer ? vehicle.customer_phone || null : null,
      p_customer_email: isNewCustomer ? vehicle.customer_email || null : null,
      p_brand: isNewMoto ? vehicle.brand : null,
      p_model: isNewMoto ? vehicle.model : null,
      p_year: isNewMoto ? vehicle.year : null,
      p_plate: isNewMoto ? vehicle.plate : null,
      p_vin: isNewMoto ? vehicle.vin : null,
    });
    if (error) fail(error);

    const id = String(data);
    const { data: order, error: readError } = await supabase.from("work_orders").select("number").eq("id", id).single();
    if (readError) fail(readError);
    return { id, folio: formatFolio(Number(order.number)) };
  },
};
