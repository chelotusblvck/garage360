"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { denyStaffWrite, getCurrentWorkshop, requireStaff } from "@/lib/auth";
import { logActionError } from "@/lib/logger";
import { loadCatalog, type Catalog } from "@/lib/sales/catalog";
import { getSalesRepository } from "@/lib/sales/repository";
import { summarizeSales } from "@/lib/sales/shared";
import { SalesError, type SaleDetail, type SalesHistory } from "@/lib/sales/types";
import { workshopBranding } from "@/lib/workshops/shared";
import {
  posSaleSchema,
  salesHistoryFiltersSchema,
  type CartItemInput,
  type PosPaymentMethod,
} from "@/lib/validations/schemas";

const idSchema = z.uuid("Identificador inválido");

/** Una venta mueve stock e ingresos: refresca dashboard (inventario, métricas, sidebar) y tienda. */
function revalidateSales() {
  revalidatePath("/", "layout");
}

function handleError<T>(error: unknown): ActionResult<T> {
  if (error instanceof SalesError) {
    return failure(error.message, error.field ? { [error.field]: [error.message] } : undefined);
  }
  logActionError("pos action", error);
  return failure("Ocurrió un error inesperado. Intenta de nuevo.");
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

/** Productos activos para el buscador y los accesos rápidos del POS. */
export async function getPosCatalog(): Promise<Catalog> {
  await requireStaff();
  return loadCatalog();
}

/**
 * Ventas de mostrador y online con filtros por fecha (días locales del
 * taller), canal, medio de pago y búsqueda por folio / cliente.
 */
export async function getSalesHistory(filters: unknown = {}): Promise<SalesHistory> {
  await requireStaff();
  const parsed = salesHistoryFiltersSchema.parse(filters ?? {});
  const sales = await getSalesRepository().history(parsed);
  return { sales, summary: summarizeSales(sales) };
}

export async function getSaleDetail(id: string): Promise<SaleDetail | null> {
  await requireStaff();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return null;
  return getSalesRepository().detail(parsed.data);
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------

/**
 * Venta directa en caja. En una sola transacción: registra la venta en
 * `sales` / `order_items` (precios del catálogo), la marca pagada y descuenta
 * stock con movimientos `pos_sale` («Venta en mostrador»).
 *
 * @returns El ticket con su número (`folio`, p. ej. "V-000123").
 */
export async function processPosSale(
  cartItems: CartItemInput[],
  paymentMethod: PosPaymentMethod,
  customerId?: string | null,
  options: { applyTax?: boolean; amountTendered?: number | null; notes?: string | null } = {}
): Promise<ActionResult<SaleDetail>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsed = posSaleSchema.safeParse({
    items: cartItems,
    payment_method: paymentMethod,
    customer_id: customerId ?? null,
    apply_tax: options.applyTax ?? false,
    amount_tendered: paymentMethod === "cash" ? (options.amountTendered ?? null) : null,
    notes: options.notes,
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const { items, payment_method, customer_id, apply_tax, amount_tendered, notes } = parsed.data;
  try {
    const sale = await getSalesRepository().createPosSale({
      items,
      payment_method,
      customer_id,
      tax_rate: apply_tax ? workshopBranding(await getCurrentWorkshop()).taxRate : 0,
      amount_tendered,
      notes,
    });
    revalidateSales();
    return success(sale);
  } catch (error) {
    return handleError(error);
  }
}
