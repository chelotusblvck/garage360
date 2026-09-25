"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  failure,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";
import { denyStaffWrite, requireStaff } from "@/lib/auth";
import { logActionError } from "@/lib/logger";
import { getInventoryRepository } from "@/lib/inventory/repository";
import {
  InventoryError,
  type InventoryStats,
  type Product,
  type StockMovement,
} from "@/lib/inventory/types";
import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_TYPES,
  productFiltersSchema,
  productSchema,
  stockAdjustmentSchema,
  type ManualStockReason,
  type StockMovementType,
} from "@/lib/validations/schemas";

const idSchema = z.uuid("Identificador inválido");

/** Refresca inventario, métricas y el badge del sidebar. */
function revalidateInventory() {
  revalidatePath("/dashboard", "layout");
}

/** Convierte errores de negocio en resultado; relanza lo inesperado. */
function handleError<T>(error: unknown): ActionResult<T> {
  if (error instanceof InventoryError) {
    return failure(error.message, error.field ? { [error.field]: [error.message] } : undefined);
  }
  logActionError("inventory action", error);
  return failure("Ocurrió un error inesperado. Intenta de nuevo.");
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export async function getProducts(filters: unknown = {}): Promise<Product[]> {
  await requireStaff();
  const parsed = productFiltersSchema.parse(filters ?? {});
  return getInventoryRepository().list(parsed);
}

export async function getInventoryStats(): Promise<InventoryStats> {
  await requireStaff();
  return getInventoryRepository().stats();
}

export async function getProductCategories(): Promise<string[]> {
  await requireStaff();
  return getInventoryRepository().categories();
}

export async function getStockMovements(productId: string): Promise<ActionResult<StockMovement[]>> {
  await requireStaff();
  const id = idSchema.safeParse(productId);
  if (!id.success) return failure("Producto inválido");

  try {
    return success(await getInventoryRepository().movements(id.data, 25));
  } catch (error) {
    return handleError(error);
  }
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------

export async function createProduct(data: unknown): Promise<ActionResult<Product>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsed = productSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const product = await getInventoryRepository().create(parsed.data);
    revalidateInventory();
    return success(product);
  } catch (error) {
    return handleError(error);
  }
}

export async function updateProduct(id: string, data: unknown): Promise<ActionResult<Product>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return failure("Producto inválido");
  const parsed = productSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const product = await getInventoryRepository().update(parsedId.data, parsed.data);
    revalidateInventory();
    return success(product);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Ajuste manual de stock. Registra el movimiento en `inventory_movements`
 * de forma atómica (función SQL adjust_stock en Supabase).
 *
 * @param quantity Unidades (siempre positivas); `type` define el signo.
 */
export async function adjustStock(
  productId: string,
  quantity: number,
  type: StockMovementType,
  reason: ManualStockReason,
  note?: string | null
): Promise<ActionResult<Product>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const parsedId = idSchema.safeParse(productId);
  if (!parsedId.success) return failure("Producto inválido");
  const parsed = stockAdjustmentSchema.safeParse({ quantity, type, reason, note });
  if (!parsed.success) return validationFailure(parsed.error);

  const { quantity: qty, type: direction, reason: why, note: detail } = parsed.data;
  const delta = direction === "in" ? qty : -qty;

  try {
    const product = await getInventoryRepository().adjust(parsedId.data, delta, why, detail);
    revalidateInventory();
    return success(product);
  } catch (error) {
    return handleError(error);
  }
}

export async function uploadProductImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const denied = await denyStaffWrite();
  if (denied) return denied;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return failure("Selecciona una imagen", { image_url: ["Selecciona una imagen"] });
  }
  if (!(PRODUCT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return failure("Formato no soportado (JPG, PNG, WebP o AVIF)", { image_url: ["Formato no soportado"] });
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return failure("La imagen supera los 5 MB", { image_url: ["La imagen supera los 5 MB"] });
  }

  try {
    return success({ url: await getInventoryRepository().uploadImage(file) });
  } catch (error) {
    return handleError(error);
  }
}
