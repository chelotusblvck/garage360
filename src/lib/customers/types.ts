import type { Customer, Motorcycle } from "@/lib/orders/types";
import type { SalesChannel } from "@/lib/sales/types";
import type {
  CustomerInput,
  CustomerMotorcycleInput,
  PhotoStage,
  SaleStatus,
  WorkOrderStatus,
} from "@/lib/validations/schemas";

/** Cliente con los datos de ficha (RUT y domicilio). */
export type CustomerProfile = Customer & {
  /** Normalizado: "12345678-9" (se muestra con formatRut). */
  rut: string | null;
  address: string | null;
  /** Comuna. */
  city: string | null;
  created_at: string;
};

/** Fila del listado de clientes. */
export type CustomerSummary = CustomerProfile & {
  motorcycles: { brand: string; model: string; plate: string }[];
  order_count: number;
  last_visit_at: string | null;
  /** Texto normalizado para el filtro instantáneo del listado. */
  search: string;
};

export type CustomerMotorcycle = Motorcycle & {
  color: string | null;
  notes: string | null;
  order_count: number;
  last_visit_at: string | null;
};

export type WorkOrderPhoto = {
  id: string;
  work_order_id: string;
  folio: string;
  motorcycle_id: string;
  stage: PhotoStage;
  /** URL pública, firmada (Supabase) o data URL (demo). */
  url: string;
  caption: string | null;
  created_at: string;
};

/** Entrada de la hoja de vida de una moto (una OT). */
export type ServiceRecord = {
  id: string;
  folio: string;
  status: WorkOrderStatus;
  motorcycle_id: string;
  intake_reason: string;
  diagnosis: string | null;
  km_at_intake: number | null;
  total_amount: number;
  mechanic_name: string | null;
  jobs: string[];
  photo_count: number;
  created_at: string;
  completed_at: string | null;
  delivered_at: string | null;
};

export type CustomerPurchase = {
  id: string;
  folio: string;
  channel: SalesChannel;
  status: SaleStatus;
  total: number;
  units: number;
  at: string;
};

export type CustomerDetail = {
  customer: CustomerProfile;
  motorcycles: CustomerMotorcycle[];
  /** OTs de todas sus motos, de la más reciente a la más antigua. */
  history: ServiceRecord[];
  photos: WorkOrderPhoto[];
  purchases: CustomerPurchase[];
};

/** Contrato común para Supabase y el modo demo. */
export interface CustomerRepository {
  list(query?: string): Promise<CustomerSummary[]>;
  detail(id: string): Promise<CustomerDetail | null>;
  create(input: CustomerInput): Promise<CustomerProfile>;
  update(id: string, input: CustomerInput): Promise<CustomerProfile>;
  addMotorcycle(customerId: string, input: CustomerMotorcycleInput): Promise<CustomerMotorcycle>;
  uploadPhoto(workOrderId: string, file: File, stage: PhotoStage, caption: string | null): Promise<WorkOrderPhoto>;
  deletePhoto(photoId: string): Promise<void>;
  /** Evidencia de una OT, en orden de captura. */
  listPhotos(workOrderId: string): Promise<WorkOrderPhoto[]>;
}

/** Error de negocio con mensaje apto para el usuario. */
export class CustomerError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "CustomerError";
  }
}
