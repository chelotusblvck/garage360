import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { getPosCatalog } from "@/app/actions/pos";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { SALES_TAX } from "@/lib/business";
import { PosTerminal } from "./_components/pos-terminal";

export const metadata: Metadata = { title: "Punto de venta" };

export default async function PosPage() {
  const catalog = await getPosCatalog();

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Punto de venta"
        description="Venta de mostrador: escanea o busca, cobra y entrega el ticket"
        actions={
          <Link href="/dashboard/sales" className={buttonVariants({ variant: "outline" })}>
            <ReceiptText data-icon="inline-start" />
            Historial de ventas
          </Link>
        }
      />
      <PosTerminal catalog={catalog} tax={SALES_TAX} />
    </div>
  );
}
