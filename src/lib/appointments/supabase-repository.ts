import "server-only";
import { logActionError } from "@/lib/logger";
import type { PostgrestError } from "@supabase/supabase-js";
import { formatFolio } from "@/lib/orders/workflow";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus, ServiceType } from "@/lib/validations/schemas";
import type { BusyInterval } from "./schedule";
import { AppointmentError, type Appointment, type AppointmentRepository } from "./types";
import { formatBookingCode } from "./workflow";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

function toAppointment(r: Row): Appointment {
  const start = new Date(String(r.scheduled_at));
  const minutes = Number(r.duration_minutes);
  return {
    id: String(r.id),
    booking_code: str(r.booking_code),
    code: formatBookingCode(str(r.booking_code)),
    service_type: r.service_type as ServiceType,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
    duration_minutes: minutes,
    status: r.status as AppointmentStatus,
    notes: str(r.notes),
    source: r.source === "public" ? "public" : "staff",
    contact: { name: str(r.contact_name), phone: str(r.contact_phone), email: str(r.contact_email) },
    customer: {
      id: String(r.customer_id),
      name: String(r.customer_name),
      phone: str(r.customer_phone),
      email: str(r.customer_email),
    },
    motorcycle: {
      id: String(r.motorcycle_id),
      brand: String(r.brand),
      model: String(r.model),
      year: Number(r.year),
      plate: String(r.plate),
      vin: null,
      current_km: Number(r.current_km),
    },
    work_order: r.work_order_id
      ? { id: String(r.work_order_id), folio: formatFolio(Number(r.work_order_number)) }
      : null,
    created_at: String(r.created_at),
  };
}

function fail(error: PostgrestError): never {
  const msg = error.message ?? "";
  if (error.code === "42501") throw new AppointmentError("No tienes permisos para esta operación");
  if (error.code === "23505" && msg.includes("customers_email_unique")) {
    throw new AppointmentError("Ya existe un cliente con ese email", "customer_email");
  }
  if (["22023", "P0002"].includes(error.code)) {
    const field = /horario|turno|domingo|anticipación|30 minutos/i.test(msg)
      ? "time"
      : /kilometraje/i.test(msg)
        ? "km"
        : /patente/i.test(msg)
          ? "plate"
          : /teléfono/i.test(msg)
            ? "customer_phone"
            : undefined;
    throw new AppointmentError(msg, field);
  }
  if (error.code === "PGRST116") throw new AppointmentError("Cita no encontrada");
  logActionError("appointments · Supabase", error);
  throw new AppointmentError("No se pudo completar la operación. Intenta de nuevo.");
}

export const supabaseAppointmentRepository: AppointmentRepository = {
  async list({ from, to, status, service }) {
    const supabase = await createClient();
    let query = supabase
      .from("v_appointments")
      .select("*")
      .gte("scheduled_at", from)
      .lt("scheduled_at", to)
      .order("scheduled_at")
      .limit(1000);
    if (status !== "all") query = query.eq("status", status);
    if (service !== "all") query = query.eq("service_type", service);
    const { data, error } = await query;
    if (error) fail(error);
    return (data as Row[]).map(toAppointment);
  },

  async get(id) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("v_appointments").select("*").eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toAppointment(data as Row) : null;
  },

  async busy(fromIso, toIso, excludeId) {
    const supabase = await createClient();
    if (excludeId) {
      // Reagendar (solo staff): excluye la propia cita del cálculo.
      const { data, error } = await supabase
        .from("appointments")
        .select("scheduled_at, duration_minutes")
        .in("status", ["scheduled", "confirmed"])
        .neq("id", excludeId)
        .lt("scheduled_at", toIso)
        .gte("scheduled_at", new Date(new Date(fromIso).getTime() - 8 * 3_600_000).toISOString());
      if (error) fail(error);
      return (data ?? []).map((r) => ({ starts_at: String(r.scheduled_at), minutes: Number(r.duration_minutes) }));
    }
    const { data, error } = await supabase.rpc("get_busy_slots", { p_from: fromIso, p_to: toIso });
    if (error) fail(error);
    return ((data ?? []) as Row[]).map((r): BusyInterval => ({
      starts_at: String(r.starts_at),
      minutes: Number(r.minutes),
    }));
  },

  async book(input, startsAt) {
    const supabase = await createClient();
    const usesExistingMoto = Boolean(input.motorcycle_id);
    const { data, error } = await supabase
      .rpc("book_appointment", {
        p_service: input.service_type,
        p_start: startsAt.toISOString(),
        p_notes: input.notes,
        p_customer_name: usesExistingMoto ? null : input.customer_name,
        p_customer_phone: usesExistingMoto ? null : input.customer_phone,
        p_customer_email: usesExistingMoto ? null : input.customer_email || null,
        p_brand: usesExistingMoto ? null : input.brand,
        p_model: usesExistingMoto ? null : input.model,
        p_year: usesExistingMoto ? null : input.year,
        p_plate: usesExistingMoto ? null : input.plate,
        p_motorcycle_id: input.motorcycle_id ?? null,
      })
      .single();
    if (error) fail(error);
    const row = data as Row;
    return {
      id: String(row.id),
      code: formatBookingCode(str(row.booking_code)),
      starts_at: new Date(String(row.scheduled_at)).toISOString(),
      duration_minutes: Number(row.duration_minutes),
    };
  },

  async updateStatus(id, status) {
    const supabase = await createClient();
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id).select("id").single();
    if (error) fail(error);
  },

  async reschedule(id, startsAt) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("reschedule_appointment", { p_id: id, p_start: startsAt.toISOString() });
    if (error) fail(error);
  },

  async convert(id, mechanicId, km) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("convert_appointment_to_work_order", {
      p_appointment_id: id,
      p_mechanic_id: mechanicId,
      p_km: km,
    });
    if (error) fail(error);
    return String(data);
  },
};
