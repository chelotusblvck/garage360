import type {
  ProductFilters,
  ProductInput,
} from "@/lib/validations/schemas";

export type StockStatus = "ok" | "low" | "out";

export type InventoryReason =
  | "sale"
  | "sale_reversal"
  | "purchase"
  | "adjustment"
  | "return"
  | "damage"
  | "workshop_use"
  | "workshop_return"
  | "pos_sale"
  | "online_sale";

export type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string;
  price: number;
  cost: number | null;
  stock: number;
  min_stock: number;
  image_url: string | null;
  is_active: boolean;
  stock_status: StockStatus;
  created_at: string;
  updated_at: string;
};

export type StockMovement = {
  id: number;
  product_id: string;
  /** Con signo: positivo = entrada, negativo = salida. */
  quantity: number;
  reason: InventoryReason;
  note: string | null;
  created_at: string;
  created_by_name: string | null;
  /** Stock resultante tras el movimiento. */
  stock_after: number;
};

export type InventoryStats = {
  activeProducts: number;
  totalUnits: number;
  /** Valor del stock a precio de costo (productos sin costo se omiten). */
  valueAtCost: number;
  lowCount: number;
  outCount: number;
};

/** Contrato común para Supabase y el modo demo. */
export interface InventoryRepository {
  list(filters: ProductFilters): Promise<Product[]>;
  stats(): Promise<InventoryStats>;
  categories(): Promise<string[]>;
  lowStock(limit?: number): Promise<Product[]>;
  create(input: ProductInput): Promise<Product>;
  update(id: string, input: ProductInput): Promise<Product>;
  adjust(productId: string, delta: number, reason: InventoryReason, note: string | null): Promise<Product>;
  movements(productId: string, limit?: number): Promise<StockMovement[]>;
  uploadImage(file: File): Promise<string>;
}

/** Error de negocio con mensaje apto para mostrar al usuario. */
export class InventoryError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "InventoryError";
  }
}
