import type {
  CartItemInput,
  EcommerceCustomerInput,
  Fulfillment,
  OnlinePaymentMethod,
  PaymentMethod,
  PosPaymentMethod,
  SaleStatus,
  SalesHistoryFilters,
  ShippingDetailsInput,
} from "@/lib/validations/schemas";

/** Canales de venta directa (las OTs facturan por su propio circuito). */
export type SalesChannel = "pos" | "online";

export type ShippingAddress = {
  street: string;
  city: string;
  postal_code: string;
};

export type SaleLine = {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type Sale = {
  id: string;
  number: number;
  /** "V-000123": número de ticket (POS) o de pedido (online). */
  folio: string;
  channel: SalesChannel;
  status: SaleStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  /** Efectivo recibido en caja (solo POS en efectivo). */
  amount_tendered: number | null;
  customer: {
    id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  fulfillment: Fulfillment | null;
  shipping_address: ShippingAddress | null;
  notes: string | null;
  seller_name: string | null;
  units: number;
  paid_at: string | null;
  created_at: string;
};

export type SaleDetail = Sale & { items: SaleLine[] };

export type SalesSummary = {
  count: number;
  revenue: number;
  units: number;
  averageTicket: number;
  byChannel: Record<SalesChannel, { count: number; revenue: number }>;
  byPaymentMethod: Partial<Record<PaymentMethod, number>>;
};

export type SalesHistory = { sales: Sale[]; summary: SalesSummary };

export type PosSaleData = {
  items: CartItemInput[];
  payment_method: PosPaymentMethod;
  customer_id: string | null;
  tax_rate: number;
  amount_tendered: number | null;
  notes: string | null;
};

export type OnlineOrderData = {
  items: CartItemInput[];
  customer: Omit<EcommerceCustomerInput, "website">;
  shipping: ShippingDetailsInput;
  payment_method: OnlinePaymentMethod;
};

/** Comprobante que ve el comprador online (sin datos internos). */
export type OnlineOrderReceipt = {
  folio: string;
  total: number;
  paid_at: string;
  fulfillment: Fulfillment;
  payment_method: OnlinePaymentMethod;
  email: string;
};

/** Ingresos cobrados, fila por venta / OT (se agrupan por mes en métricas). */
export type RevenueEntry = {
  channel: SalesChannel | "workshop";
  amount: number;
  at: string;
};

/** Contrato común para Supabase y el modo demo. */
export interface SalesRepository {
  createPosSale(data: PosSaleData): Promise<SaleDetail>;
  createOnlineOrder(data: OnlineOrderData): Promise<OnlineOrderReceipt>;
  history(filters: SalesHistoryFilters, limit?: number): Promise<Sale[]>;
  detail(id: string): Promise<SaleDetail | null>;
  /** Unidades vendidas por producto en los últimos `days` días. */
  popularity(days?: number): Promise<Record<string, number>>;
  /** Ventas (POS + online) y OTs entregadas cobradas desde `fromIso`. */
  revenue(fromIso: string): Promise<RevenueEntry[]>;
}

/** Error de negocio con mensaje apto para mostrar al usuario. */
export class SalesError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "SalesError";
  }
}
