import "server-only";
import { demoDb, insertDemoWorkOrder, newBookingCode, type DemoAppointment, type DemoDb } from "@/lib/demo/db";
import { formatFolio } from "@/lib/orders/workflow";
import { PUBLIC_MIN_LEAD_MINUTES, SERVICE_DURATION, validateSlot, type BusyInterval } from "./schedule";
import {
  AppointmentError,
  type Appointment,
  type AppointmentRepository,
} from "./types";
import { canConvertToWorkOrder, canTransitionAppointment, formatBookingCode } from "./workflow";

/* Repositorio de citas en memoria (modo demo). Mismas reglas que el SQL. */

const SERVICE_REASON = {
  maintenance: "Mantenimiento programado",
  inspection: "Inspección / revisión",
  repair: "Diagnóstico por falla",
} as const;

function toAppointment(db: DemoDb, a: DemoAppointment): Appointment {
  const moto = db.motorcycles.find((m) => m.id === a.motorcycle_id)!;
  const customer = db.customers.find((c) => c.id === a.customer_id)!;
  const order = db.workOrders.find((o) => o.appointment_id === a.id);
  const start = new Date(a.scheduled_at);

  return {
    id: a.id,
    booking_code: a.booking_code,
    code: formatBookingCode(a.booking_code),
    service_type: a.service_type,
    starts_at: a.scheduled_at,
    ends_at: new Date(start.getTime() + a.duration_minutes * 60_000).toISOString(),
    duration_minutes: a.duration_minutes,
    status: a.status,
    notes: a.notes,
    source: a.source,
    contact: { name: a.contact_name, phone: a.contact_phone, email: a.contact_email },
    customer: { ...customer },
    motorcycle: {
      id: moto.id,
      brand: moto.brand,
      model: moto.model,
      year: moto.year,
      plate: moto.plate,
      vin: moto.vin,
      current_km: moto.current_km,
    },
    work_order: order ? { id: order.id, folio: formatFolio(order.number) } : null,
    created_at: a.created_at,
  };
}

function busyIntervals(db: DemoDb, excludeId?: string): BusyInterval[] {
  return db.appointments
    .filter((a) => (a.status === "scheduled" || a.status === "confirmed") && a.id !== excludeId)
    .map((a) => ({ starts_at: a.scheduled_at, minutes: a.duration_minutes }));
}

function findAppointment(db: DemoDb, id: string) {
  const appointment = db.appointments.find((a) => a.id === id);
  if (!appointment) throw new AppointmentError("Cita no encontrada");
  return appointment;
}

export const demoAppointmentRepository: AppointmentRepository = {
  async list({ from, to, status, service }) {
    const db = demoDb();
    return db.appointments
      .filter((a) => a.scheduled_at >= from && a.scheduled_at < to)
      .filter((a) => status === "all" || a.status === status)
      .filter((a) => service === "all" || a.service_type === service)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .map((a) => toAppointment(db, a));
  },

  async get(id) {
    const db = demoDb();
    const appointment = db.appointments.find((a) => a.id === id);
    return appointment ? toAppointment(db, appointment) : null;
  },

  async busy(fromIso, toIso, excludeId) {
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();
    return busyIntervals(demoDb(), excludeId).filter((b) => {
      const start = new Date(b.starts_at).getTime();
      return start < to && start + b.minutes * 60_000 > from;
    });
  },

  async book(input, startsAt, isStaff) {
    const db = demoDb();
    const minutes = SERVICE_DURATION[input.service_type];
    const error = validateSlot({
      start: startsAt,
      minutes,
      busy: busyIntervals(db),
      minLeadMinutes: isStaff ? 0 : PUBLIC_MIN_LEAD_MINUTES,
    });
    if (error) throw new AppointmentError(error, "time");

    let motoId: string;
    let customerId: string;

    if (isStaff && input.motorcycle_id) {
      const moto = db.motorcycles.find((m) => m.id === input.motorcycle_id);
      if (!moto) throw new AppointmentError("Moto no encontrada", "plate");
      motoId = moto.id;
      customerId = moto.customer_id;
    } else {
      const existing = db.motorcycles.find((m) => m.plate === input.plate);
      if (existing) {
        // La moto ya vino al taller: se vincula a su ficha (se verifica en recepción).
        motoId = existing.id;
        customerId = existing.customer_id;
      } else {
        const email = input.customer_email || null;
        const byEmail = email ? db.customers.find((c) => c.email?.toLowerCase() === email) : undefined;
        if (byEmail) {
          customerId = byEmail.id;
        } else {
          customerId = crypto.randomUUID();
          db.customers.push({ id: customerId, name: input.customer_name, phone: input.customer_phone, email });
        }
        motoId = crypto.randomUUID();
        db.motorcycles.push({
          id: motoId,
          customer_id: customerId,
          brand: input.brand,
          model: input.model,
          year: input.year!,
          plate: input.plate,
          vin: null,
          current_km: 0,
        });
      }
    }

    const appointment: DemoAppointment = {
      id: crypto.randomUUID(),
      booking_code: newBookingCode(db),
      customer_id: customerId,
      motorcycle_id: motoId,
      service_type: input.service_type,
      scheduled_at: startsAt.toISOString(),
      duration_minutes: minutes,
      status: "scheduled",
      notes: input.notes,
      source: isStaff ? "staff" : "public",
      contact_name: input.motorcycle_id ? null : input.customer_name || null,
      contact_phone: input.motorcycle_id ? null : input.customer_phone || null,
      contact_email: input.motorcycle_id ? null : input.customer_email || null,
      created_at: new Date().toISOString(),
    };
    db.appointments.push(appointment);

    return {
      id: appointment.id,
      code: formatBookingCode(appointment.booking_code),
      starts_at: appointment.scheduled_at,
      duration_minutes: minutes,
    };
  },

  async updateStatus(id, status) {
    const appointment = findAppointment(demoDb(), id);
    if (!canTransitionAppointment(appointment.status, status)) {
      throw new AppointmentError("Transición de estado de cita no permitida");
    }
    appointment.status = status;
  },

  async reschedule(id, startsAt) {
    const db = demoDb();
    const appointment = findAppointment(db, id);
    if (appointment.status === "completed") {
      throw new AppointmentError("La cita ya se convirtió en orden de trabajo");
    }
    const error = validateSlot({
      start: startsAt,
      minutes: appointment.duration_minutes,
      busy: busyIntervals(db, id),
    });
    if (error) throw new AppointmentError(error, "time");
    appointment.scheduled_at = startsAt.toISOString();
    if (appointment.status === "cancelled" || appointment.status === "no_show") {
      appointment.status = "scheduled";
    }
  },

  async convert(id, mechanicId, km) {
    const db = demoDb();
    const appointment = findAppointment(db, id);
    const existing = db.workOrders.find((o) => o.appointment_id === id);
    if (existing) return existing.id;

    if (!canConvertToWorkOrder(appointment.status)) {
      throw new AppointmentError("Solo se pueden convertir citas agendadas o confirmadas");
    }
    if (mechanicId && !db.mechanics.some((m) => m.id === mechanicId)) {
      throw new AppointmentError("Mecánico no encontrado", "mechanic_id");
    }
    const moto = db.motorcycles.find((m) => m.id === appointment.motorcycle_id)!;
    if (km !== null && km < moto.current_km) {
      throw new AppointmentError(`El kilometraje es menor al último registrado (${moto.current_km} km)`, "km");
    }

    const reason =
      `Cita ${formatBookingCode(appointment.booking_code)} · ${SERVICE_REASON[appointment.service_type]}` +
      (appointment.notes ? `\n${appointment.notes}` : "");

    const order = insertDemoWorkOrder(db, {
      motorcycle_id: moto.id,
      mechanic_id: mechanicId,
      intake_reason: reason,
      km: km ?? moto.current_km,
      appointment_id: id,
    });
    appointment.status = "completed";
    return order.id;
  },
};
