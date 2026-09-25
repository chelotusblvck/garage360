import type { Customer, Motorcycle } from "@/lib/orders/types";
import type {
  AppointmentStatus,
  BookingInput,
  ServiceType,
} from "@/lib/validations/schemas";
import type { BusyInterval } from "./schedule";

export type Appointment = {
  id: string;
  booking_code: string | null;
  /** Código visible: MO-XXXXXX. */
  code: string;
  service_type: ServiceType;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  source: "staff" | "public";
  /** Datos de contacto tal como los ingresó quien reservó. */
  contact: { name: string | null; phone: string | null; email: string | null };
  customer: Customer;
  motorcycle: Motorcycle;
  work_order: { id: string; folio: string } | null;
  created_at: string;
};

export type AppointmentRange = {
  /** Instantes UTC (ISO) del rango [from, to). */
  from: string;
  to: string;
  status: "all" | AppointmentStatus;
  service: "all" | ServiceType;
};

export type DaySummary = {
  date: string;
  total: number;
  scheduled: number;
  confirmed: number;
  maintenance: number;
  next: Appointment | null;
};

export type BookingResult = {
  id: string;
  code: string;
  starts_at: string;
  duration_minutes: number;
};

export interface AppointmentRepository {
  list(range: AppointmentRange): Promise<Appointment[]>;
  get(id: string): Promise<Appointment | null>;
  /** Ocupación sin datos personales; `excludeId` solo para staff (reagendar). */
  busy(fromIso: string, toIso: string, excludeId?: string): Promise<BusyInterval[]>;
  book(input: BookingInput, startsAt: Date, isStaff: boolean): Promise<BookingResult>;
  updateStatus(id: string, status: AppointmentStatus): Promise<void>;
  reschedule(id: string, startsAt: Date): Promise<void>;
  /** Devuelve el id de la OT (existente o nueva). */
  convert(id: string, mechanicId: string | null, km: number | null): Promise<string>;
}

export class AppointmentError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "AppointmentError";
  }
}
