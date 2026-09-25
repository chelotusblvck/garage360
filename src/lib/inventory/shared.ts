import type { InventoryStats, Product, StockMovement } from "./types";

/**
 * Calcula el saldo tras cada movimiento partiendo del stock actual.
 * `rows` debe venir ordenado del más reciente al más antiguo.
 */
export function withRunningBalance(
  currentStock: number,
  rows: Omit<StockMovement, "stock_after">[]
): StockMovement[] {
  let balance = currentStock;
  return rows.map((row) => {
    const withBalance = { ...row, stock_after: balance };
    balance -= row.quantity;
    return withBalance;
  });
}

export function computeStats(products: Pick<Product, "stock" | "cost" | "is_active" | "stock_status">[]): InventoryStats {
  const active = products.filter((p) => p.is_active);
  return {
    activeProducts: active.length,
    totalUnits: active.reduce((sum, p) => sum + p.stock, 0),
    valueAtCost: active.reduce((sum, p) => sum + p.stock * (p.cost ?? 0), 0),
    lowCount: active.filter((p) => p.stock_status === "low").length,
    outCount: active.filter((p) => p.stock_status === "out").length,
  };
}

/** Quita caracteres con significado en los filtros de PostgREST / LIKE. */
export function sanitizeSearch(term: string) {
  return term.replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim();
}
