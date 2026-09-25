import type { Metadata } from "next";
import { connection } from "next/server";
import { getShopCatalog } from "@/app/actions/ecommerce";
import { SHOP } from "@/lib/business";
import { CheckoutView } from "./checkout-view";

export const metadata: Metadata = { title: "Finalizar compra" };

export default async function CheckoutPage() {
  // Precios y stock vigentes para validar el carrito guardado en el navegador.
  await connection();
  const catalog = await getShopCatalog();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 md:py-10">
      <CheckoutView products={catalog.products} shop={SHOP} />
    </div>
  );
}
