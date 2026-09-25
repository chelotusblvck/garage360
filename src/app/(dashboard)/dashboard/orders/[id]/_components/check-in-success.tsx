"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleCheck, Mail, MessageCircle, Printer, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { WORKSHOP } from "@/lib/business";
import { FUEL_LEVEL_LABEL } from "@/lib/checkin/shared";
import { whatsappUrl } from "@/lib/customers/shared";
import { formatKm, formatPlate } from "@/lib/format";
import type { WorkOrderSummary } from "@/lib/orders/types";

/** Aviso tras el check-in: imprimir o enviar el comprobante de recepción. */
export function CheckInSuccess({ order, photoCount }: { order: WorkOrderSummary; photoCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { customer, motorcycle: moto } = order;

  const message = [
    `Hola ${customer.name.split(" ")[0]}, recibimos tu ${moto.brand} ${moto.model} (${formatPlate(moto.plate)}) en ${WORKSHOP.name}.`,
    `Orden de trabajo ${order.folio}` +
      (order.km_at_intake !== null ? ` · ${formatKm(order.km_at_intake)}` : "") +
      (order.fuel_level ? ` · combustible ${FUEL_LEVEL_LABEL[order.fuel_level]}` : "") +
      ".",
    `Registramos ${photoCount} fotos del estado de ingreso. Te avisaremos apenas tengamos el diagnóstico.`,
  ].join("\n");

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-status-good/10 p-4 ring-1 ring-status-good/30 xl:flex-row xl:items-center" role="status">
      <CircleCheck className="size-6 shrink-0 text-status-good" aria-hidden />
      <div className="grid flex-1 gap-0.5">
        <p className="font-medium">
          Moto recepcionada: {order.folio} con {photoCount} fotos de ingreso
        </p>
        <p className="text-sm text-muted-foreground">Imprime el comprobante para la firma del cliente o envíaselo.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/print/orders/${order.id}?type=reception`}
          target="_blank"
          className={buttonVariants({ size: "lg", className: "h-9 px-3" })}
        >
          <Printer data-icon="inline-start" />
          Comprobante con fotos
        </Link>
        {customer.phone ? (
          <a
            href={`${whatsappUrl(customer.phone)}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline", size: "lg", className: "h-9 px-3" })}
          >
            <MessageCircle data-icon="inline-start" className="text-status-good" />
            WhatsApp
          </a>
        ) : null}
        {customer.email ? (
          <a
            href={`mailto:${customer.email}?subject=${encodeURIComponent(`Recepción ${order.folio} · ${WORKSHOP.name}`)}&body=${encodeURIComponent(message)}`}
            className={buttonVariants({ variant: "outline", size: "lg", className: "h-9 px-3" })}
          >
            <Mail data-icon="inline-start" />
            Email
          </a>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar aviso"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
