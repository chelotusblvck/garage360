import type { InventoryReason, StockStatus } from "./types";

export const DEFAULT_CATEGORIES = [
  "Frenos",
  "Lubricantes",
  "Filtros",
  "Transmisión",
  "Neumáticos",
  "Encendido",
  "Suspensión",
  "Eléctrico",
  "Accesorios",
] as const;

export function getStockStatus(stock: number, minStock: number): StockStatus {
  if (stock === 0) return "out";
  if (stock <= minStock) return "low";
  return "ok";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  ok: "En stock",
  low: "Stock bajo",
  out: "Agotado",
};

export const STOCK_FILTER_LABEL = {
  all: "Todos los estados",
  low: "Stock bajo",
  out: "Agotados",
} as const;

/** Etiquetas para el historial de movimientos. */
export const MOVEMENT_REASON_LABEL: Record<InventoryReason, string> = {
  sale: "Venta",
  sale_reversal: "Anulación de venta",
  purchase: "Recepción de proveedor",
  return: "Devolución de cliente",
  adjustment: "Ajuste de inventario físico",
  damage: "Repuesto dañado / merma",
  workshop_use: "Insumo de taller (OT)",
  workshop_return: "Devolución desde OT",
  pos_sale: "Venta en mostrador (POS)",
  online_sale: "Venta e-commerce",
};
