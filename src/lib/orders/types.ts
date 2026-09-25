import type {
  CreateWorkOrderInput,
  LaborItemInput,
  FuelLevel,
  WorkOrderDetailsInput,
  WorkOrderFilters,
  WorkOrderStatus,
} from "@/lib/validations/schemas";

export type Mechanic = { id: string; name: string };

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export type Motorcycle = {
  id: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  vin: string | null;
  current_km: number;
};

export type WorkOrderSummary = {
  id: string;
  number: number;
  folio: string;
  status: WorkOrderStatus;
  intake_reason: string;
  diagnosis: string | null;
  km_at_intake: number | null;
  /** Nivel de combustible registrado en la recepción. */
  fuel_level: FuelLevel | null;
  parts_amount: number;
  labor_amount: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  delivered_at: string | null;
  motorcycle: Motorcycle;
  customer: Customer;
  mechanic: Mechanic | null;
  /** Código de la cita que originó la OT (si la hubo). */
  appointment_code: string | null;
};

export type WorkOrderPart = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
};

export type WorkOrderLabor = {
  id: string;
  description: string;
  hours: number;
  hourly_rate: number;
  line_total: number;
  created_at: string;
};

export type WorkOrderDetail = WorkOrderSummary & {
  parts: WorkOrderPart[];
  labor: WorkOrderLabor[];
};

export type MotorcycleLookup = { motorcycle: Motorcycle; customer: Customer };

export type WorkOrderCounts = Record<WorkOrderStatus, number>;

/** Contrato común para Supabase y el modo demo. */
export interface WorkOrderRepository {
  list(filters: WorkOrderFilters): Promise<WorkOrderSummary[]>;
  counts(): Promise<WorkOrderCounts>;
  detail(id: string): Promise<WorkOrderDetail | null>;
  create(input: CreateWorkOrderInput): Promise<WorkOrderSummary>;
  updateStatus(id: string, status: WorkOrderStatus): Promise<void>;
  updateDetails(id: string, input: WorkOrderDetailsInput): Promise<void>;
  addPart(workOrderId: string, productId: string, quantity: number, unitPrice: number | null): Promise<void>;
  removePart(workOrderId: string, partId: string): Promise<void>;
  addLabor(workOrderId: string, input: LaborItemInput): Promise<void>;
  removeLabor(workOrderId: string, laborId: string): Promise<void>;
  mechanics(): Promise<Mechanic[]>;
  searchCustomers(query: string): Promise<Customer[]>;
  findMotorcycleByPlate(plate: string): Promise<MotorcycleLookup | null>;
}

/** Error de negocio con mensaje apto para el usuario. */
export class WorkOrderError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "WorkOrderError";
  }
}
