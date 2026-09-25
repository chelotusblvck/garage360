"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireStaff } from "@/lib/auth";
import { getCustomerRepository } from "@/lib/customers/repository";
import {
  CustomerError,
  type CustomerDetail,
  type CustomerMotorcycle,
  type CustomerProfile,
  type CustomerSummary,
  type WorkOrderPhoto,
} from "@/lib/customers/types";
import {
  customerFiltersSchema,
  customerMotorcycleSchema,
  customerSchema,
  photoCaptionSchema,
  photoStageSchema,
  WORK_ORDER_PHOTO_MAX_BYTES,
  WORK_ORDER_PHOTO_TYPES,
  type PhotoStage,
} from "@/lib/validations/schemas";

const idSchema = z.uuid("Identificador inválido");

/** Clientes y motos aparecen en OTs, citas y ventas: refresca todo el panel. */
function revalidateCustomers() {
  revalidatePath("/dashboard", "layout");
}

function handleError<T>(error: unknown): ActionResult<T> {
  if (error instanceof CustomerError) {
    return failure(error.message, error.field ? { [error.field]: [error.message] } : undefined);
  }
  console.error("[customers action]", error);
  return failure("Ocurrió un error inesperado. Intenta de nuevo.");
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

/**
 * Búsqueda global: nombre, RUT (con o sin puntos), email, teléfono, comuna,
 * patente o marca / modelo de sus motos ("Panigale", "Street Triple").
 */
export async function getCustomers(query?: string): Promise<CustomerSummary[]> {
  await requireStaff();
  const { q } = customerFiltersSchema.parse({ q: query });
  return getCustomerRepository().list(q || undefined);
}

/** Ficha del cliente: motos, hoja de vida (OTs), evidencia fotográfica y compras. */
export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  await requireStaff();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return null;
  return getCustomerRepository().detail(parsed.data);
}

/** Evidencia fotográfica de una OT (recepción, proceso y entrega). */
export async function getWorkOrderPhotos(workOrderId: string): Promise<WorkOrderPhoto[]> {
  await requireStaff();
  const parsed = idSchema.safeParse(workOrderId);
  if (!parsed.success) return [];
  return getCustomerRepository().listPhotos(parsed.data);
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------

export async function createCustomer(data: unknown): Promise<ActionResult<CustomerProfile>> {
  await requireStaff();
  const parsed = customerSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const customer = await getCustomerRepository().create(parsed.data);
    revalidateCustomers();
    return success(customer);
  } catch (error) {
    return handleError(error);
  }
}

export async function updateCustomer(id: string, data: unknown): Promise<ActionResult<CustomerProfile>> {
  await requireStaff();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return failure("Cliente inválido");
  const parsed = customerSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const customer = await getCustomerRepository().update(parsedId.data, parsed.data);
    revalidateCustomers();
    return success(customer);
  } catch (error) {
    return handleError(error);
  }
}

export async function addCustomerMotorcycle(customerId: string, data: unknown): Promise<ActionResult<CustomerMotorcycle>> {
  await requireStaff();
  const parsedId = idSchema.safeParse(customerId);
  if (!parsedId.success) return failure("Cliente inválido");
  const parsed = customerMotorcycleSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const moto = await getCustomerRepository().addMotorcycle(parsedId.data, parsed.data);
    revalidateCustomers();
    return success(moto);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Sube una foto de evidencia de la OT (recepción, trabajo en proceso o
 * entrega) al bucket privado `work-order-photos` de Supabase Storage.
 * En modo demo se guarda en memoria.
 */
export async function uploadWorkOrderPhoto(
  workOrderId: string,
  file: File,
  category: PhotoStage,
  caption?: string | null
): Promise<ActionResult<WorkOrderPhoto>> {
  await requireStaff();
  const parsedId = idSchema.safeParse(workOrderId);
  if (!parsedId.success) return failure("Selecciona una orden de trabajo", { work_order_id: ["Selecciona una OT"] });
  const stage = photoStageSchema.safeParse(category);
  if (!stage.success) return failure("Etapa de la foto inválida", { stage: ["Etapa inválida"] });
  const text = photoCaptionSchema.safeParse(caption ?? "");
  if (!text.success) return validationFailure(text.error);

  if (!(file instanceof File) || file.size === 0) {
    return failure("Selecciona una imagen", { file: ["Selecciona una imagen"] });
  }
  if (!(WORK_ORDER_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return failure("Formato no soportado (JPG, PNG, WebP o AVIF)", { file: ["Formato no soportado"] });
  }
  if (file.size > WORK_ORDER_PHOTO_MAX_BYTES) {
    return failure("La imagen supera los 5 MB", { file: ["La imagen supera los 5 MB"] });
  }

  try {
    const photo = await getCustomerRepository().uploadPhoto(parsedId.data, file, stage.data, text.data);
    revalidateCustomers();
    return success(photo);
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteWorkOrderPhoto(photoId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const parsedId = idSchema.safeParse(photoId);
  if (!parsedId.success) return failure("Foto inválida");

  try {
    await getCustomerRepository().deletePhoto(parsedId.data);
    revalidateCustomers();
    return success(null);
  } catch (error) {
    return handleError(error);
  }
}
