"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { denyStaffWrite, requireStaff } from "@/lib/auth";
import { getInventoryRepository } from "@/lib/inventory/repository";
import type { Product } from "@/lib/inventory/types";
import { getWorkOrderRepository } from "@/lib/orders/repository";
import {
  WorkOrderError,
  type Customer,
  type Mechanic,
  type MotorcycleLookup,
  type WorkOrderCounts,
  type WorkOrderDetail,
  type WorkOrderSummary,
} from "@/lib/orders/types";
import {
  laborItemSchema,
  orderPartSchema,
  workOrderDetailsSchema,
  workOrderFiltersSchema,
  workOrderStatusSchema,
  type WorkOrderStatus,
} from "@/lib/validations/schemas";

const idSchema = z.uuid("Identificador inválido");

/** Las OTs mueven stock: refresca órdenes, inventario, métricas y sidebar. */
function revalidateWorkshop() {
  revalidatePath("/dashboard", "layout");
}

function handleError<T>(error: unknown): ActionResult<T> {
  if (error instanceof WorkOrderError) {
    return failure(error.message, error.field ? { [error.field]: [error.message] } : undefined);
  }
  console.error("[orders action]", error);
  return failure("Ocurrió un error inesperado. Intenta de nuevo.");
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export async function getWorkOrders(filters: unknown = {}): Promise<WorkOrderSummary[]> {
  await requireStaff();
  return getWorkOrderRepository().list(workOrderFiltersSchema.parse(filters ?? {}));
}

export async function getWorkOrderCounts(): Promise<WorkOrderCounts> {
  await requireStaff();
  return getWorkOrderRepository().counts();
}

export async function getWorkOrderDetail(id: string): Promise<WorkOrderDetail | null> {
  await requireStaff();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return null;
  return getWorkOrderRepository().detail(parsed.data);
}

export async function getMechanics(): Promise<Mechanic[]> {
  await requireStaff();
  return getWorkOrderRepository().mechanics();
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  await requireStaff();
  const term = z.string().trim().min(2).max(60).safeParse(query);
  return term.success ? getWorkOrderRepository().searchCustomers(term.data) : [];
}

export async function findMotorcycleByPlate(plate: string): Promise<MotorcycleLookup | null> {
  await requireStaff();
  const term = z.string().trim().min(4).max(12).safeParse(plate);
  return term.success ? getWorkOrderRepository().findMotorcycleByPlate(term.data) : null;
}

/** Buscador rápido de repuestos para asignar a una OT (solo productos activos). */
export async function searchProductsForOrder(query: string): Promise<Product[]> {
  await requireStaff();
  const term = z.string().trim().max(60).safeParse(query);
  if (!term.success) return [];
  const products = await getInventoryRepository().list({ q: term.data || undefined, status: "all" });
  return products.filter((p) => p.is_active).slice(0, 8);
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------
// El alta de OT vive en actions/check-in.ts: exige las fotos de recepción.

export async function updateWorkOrderStatus(id: string, status: WorkOrderStatus): Promise<ActionResult<null>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsedId = idSchema.safeParse(id);
  const parsedStatus = workOrderStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return failure("Datos inválidos");

  try {
    await getWorkOrderRepository().updateStatus(parsedId.data, parsedStatus.data);
    revalidateWorkshop();
    return success(null);
  } catch (error) {
    return handleError(error);
  }
}

export async function updateWorkOrderDetails(id: string, data: unknown): Promise<ActionResult<null>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return failure("Orden inválida");
  const parsed = workOrderDetailsSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await getWorkOrderRepository().updateDetails(parsedId.data, parsed.data);
    revalidateWorkshop();
    return success(null);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Asigna un repuesto a la OT. Descuenta stock en el mismo paso y registra el
 * movimiento de inventario como "insumo de taller" (workshop_use).
 *
 * @param unitPrice `null` = precio de lista del producto.
 */
export async function addOrderItem(
  workOrderId: string,
  productId: string,
  quantity: number,
  unitPrice: number | null = null
): Promise<ActionResult<null>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsedId = idSchema.safeParse(workOrderId);
  if (!parsedId.success) return failure("Orden inválida");
  const parsed = orderPartSchema.safeParse({ product_id: productId, quantity, unit_price: unitPrice });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const { product_id, quantity: qty, unit_price } = parsed.data;
    await getWorkOrderRepository().addPart(parsedId.data, product_id, qty, unit_price);
    revalidateWorkshop();
    return success(null);
  } catch (error) {
    return handleError(error);
  }
}

/** Quita un repuesto de la OT y devuelve las unidades al inventario. */
export async function removeOrderItem(workOrderId: string, itemId: string): Promise<ActionResult<null>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const ids = z.tuple([idSchema, idSchema]).safeParse([workOrderId, itemId]);
  if (!ids.success) return failure("Datos inválidos");

  try {
    await getWorkOrderRepository().removePart(ids.data[0], ids.data[1]);
    revalidateWorkshop();
    return success(null);
  } catch (error) {
    return handleError(error);
  }
}

export async function addLaborItem(
  workOrderId: string,
  description: string,
  hours: number,
  hourlyRate: number
): Promise<ActionResult<null>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsedId = idSchema.safeParse(workOrderId);
  if (!parsedId.success) return failure("Orden inválida");
  const parsed = laborItemSchema.safeParse({ description, hours, hourly_rate: hourlyRate });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await getWorkOrderRepository().addLabor(parsedId.data, parsed.data);
    revalidateWorkshop();
    return success(null);
  } catch (error) {
    return handleError(error);
  }
}

export async function removeLaborItem(workOrderId: string, laborId: string): Promise<ActionResult<null>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const ids = z.tuple([idSchema, idSchema]).safeParse([workOrderId, laborId]);
  if (!ids.success) return failure("Datos inválidos");

  try {
    await getWorkOrderRepository().removeLabor(ids.data[0], ids.data[1]);
    revalidateWorkshop();
    return success(null);
  } catch (error) {
    return handleError(error);
  }
}
