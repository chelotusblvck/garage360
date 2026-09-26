import type { HardwareLine, PlanKey, SetupType } from "@/lib/workshops/plans";

/* Cotizaciones de alta (catálogo público de /login). Compartido por cliente y servidor. */

export const QUOTATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export type Quotation = {
  id: string;
  workshop_name: string;
  contact_name: string;
  email: string;
  phone: string;
  comuna: string | null;
  plan_type: PlanKey;
  setup_type: SetupType;
  selected_hardware: HardwareLine[];
  /** Pago inicial: setup + equipamiento (CLP, IVA incluido). */
  estimated_total_clp: number;
  /** Mensualidad del plan (CLP, IVA incluido). */
  monthly_clp: number;
  status: QuotationStatus;
  /** Taller creado al aprobarla. */
  workshop_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type NewQuotation = Omit<Quotation, "id" | "status" | "workshop_id" | "reviewed_at" | "created_at">;

export interface QuotationRepository {
  /** Público (sin sesión): devuelve solo el id. */
  create(input: NewQuotation): Promise<{ id: string }>;
  /** Más recientes primero (superadmin). */
  list(): Promise<Quotation[]>;
  get(id: string): Promise<Quotation | null>;
  reject(id: string): Promise<void>;
}

/** Error de negocio con mensaje apto para el usuario. */
export class QuotationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotationError";
  }
}
