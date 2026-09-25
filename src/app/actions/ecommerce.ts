"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { SHOP } from "@/lib/business";
import { logActionError } from "@/lib/logger";
import { loadCatalog, type Catalog } from "@/lib/sales/catalog";
import { getSalesRepository } from "@/lib/sales/repository";
import { SalesError, type OnlineOrderReceipt } from "@/lib/sales/types";
import {
  cartItemSchema,
  checkoutFormSchema,
  type CartItemInput,
  type CheckoutFormValues,
  type OnlinePaymentMethod,
} from "@/lib/validations/schemas";

const cartSchema = z
  .array(cartItemSchema)
  .min(1, "El carrito está vacío")
  .max(50, "Máximo 50 productos distintos")
  .refine((items) => items.every((i) => i.quantity <= SHOP.maxUnitsPerProduct), {
    message: `Máximo ${SHOP.maxUnitsPerProduct} unidades por producto`,
  });

// ---------------------------------------------------------------------------
// Lecturas (públicas)
// ---------------------------------------------------------------------------

/** Catálogo público: productos activos con stock y popularidad. */
export async function getShopCatalog(): Promise<Catalog> {
  return loadCatalog();
}

// ---------------------------------------------------------------------------
// Escrituras (públicas, sin cuenta)
// ---------------------------------------------------------------------------

/**
 * Compra online. En una sola transacción: crea (o reutiliza por email) el
 * cliente, registra la venta con precios del catálogo, la confirma y descuenta
 * stock con movimientos `online_sale` («Venta e-commerce»).
 */
export async function processEcommerceOrder(
  cartItems: CartItemInput[],
  customerData: CheckoutFormValues["customer"],
  shippingDetails: CheckoutFormValues["shipping"],
  paymentMethod: OnlinePaymentMethod = "online"
): Promise<ActionResult<OnlineOrderReceipt>> {
  const items = cartSchema.safeParse(cartItems);
  if (!items.success) return failure(items.error.issues[0]?.message ?? "Carrito inválido");

  const parsed = checkoutFormSchema.safeParse({
    customer: customerData,
    shipping: shippingDetails,
    payment_method: paymentMethod,
  });
  if (!parsed.success) return validationFailure(parsed.error);
  if (parsed.data.customer.website) return failure("No se pudo procesar el pedido"); // honeypot

  const { name, email, phone } = parsed.data.customer;
  try {
    const receipt = await getSalesRepository().createOnlineOrder({
      items: items.data,
      customer: { name, email, phone },
      shipping: parsed.data.shipping,
      payment_method: parsed.data.payment_method,
    });
    revalidatePath("/", "layout");
    return success(receipt);
  } catch (error) {
    if (error instanceof SalesError) {
      return failure(error.message, error.field ? { [error.field]: [error.message] } : undefined);
    }
    logActionError("ecommerce action", error);
    return failure("No pudimos procesar tu pedido. Intenta de nuevo en unos minutos.");
  }
}
