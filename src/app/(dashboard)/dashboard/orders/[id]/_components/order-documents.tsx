"use client";

import { useState } from "react";
import { ExternalLink, FileText, MessageCircle, Printer } from "lucide-react";
import { WorkOrderDocument } from "@/components/orders/work-order-document";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WorkOrderPhoto } from "@/lib/customers/types";
import { whatsappUrl } from "@/lib/customers/shared";
import { WORK_ORDER_DOC_TITLE, invoiceMessage, receptionMessage, type WorkOrderDocType } from "@/lib/orders/documents";
import type { WorkOrderDetail } from "@/lib/orders/types";
import type { WorkshopBranding } from "@/lib/workshops/shared";

type Props = {
  order: WorkOrderDetail;
  workshop: WorkshopBranding;
  customerRut: string | null;
  /** Fotos de la etapa de recepción. */
  photos: WorkOrderPhoto[];
};

const DESCRIPTION: Record<WorkOrderDocType, string> = {
  reception: "Estado de ingreso de la moto con registro fotográfico, para la firma de conformidad del cliente.",
  invoice: "Liquidación del servicio: mano de obra, repuestos e IVA. Imprímelo o guárdalo como PDF.",
};

/**
 * Botones «Recepción» y «Comprobante» de la OT: vista previa en un diálogo,
 * impresión directa (el CSS de impresión deja solo el documento) y envío por
 * WhatsApp. La versión en pestaña aparte sigue en /print/orders/[id].
 */
export function OrderDocuments({ order, workshop, customerRut, photos }: Props) {
  const [open, setOpen] = useState(false);
  // Aparte de `open`: el contenido se mantiene durante la animación de cierre.
  const [type, setType] = useState<WorkOrderDocType>("reception");

  function show(next: WorkOrderDocType) {
    setType(next);
    setOpen(true);
  }

  const phone = order.customer.phone;
  const message = type === "reception" ? receptionMessage(order, photos.length, workshop.name) : invoiceMessage(order, workshop);

  return (
    <>
      <Button variant="outline" className="h-9" onClick={() => show("reception")}>
        <FileText data-icon="inline-start" />
        Recepción
      </Button>
      <Button variant="outline" className="h-9" onClick={() => show("invoice")}>
        <Printer data-icon="inline-start" />
        Comprobante
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-[calc(210mm+3rem)] print:static print:block print:max-h-none print:max-w-none print:translate-none print:rounded-none print:bg-white print:p-0 print:ring-0 print:[&>[data-slot=dialog-close]]:hidden">
          <DialogHeader className="pr-8 print:hidden">
            <DialogTitle>
              {WORK_ORDER_DOC_TITLE[type]} · <span className="font-mono">{order.folio}</span>
            </DialogTitle>
            <DialogDescription>{DESCRIPTION[type]}</DialogDescription>
          </DialogHeader>

          <div className="-mx-4 overflow-y-auto bg-muted/60 px-4 py-4 print:m-0 print:overflow-visible print:bg-white print:p-0">
            <WorkOrderDocument
              type={type}
              workshop={workshop}
              order={order}
              customerRut={customerRut}
              photos={type === "reception" ? photos : []}
              issuedAt={new Date()}
            />
          </div>

          <DialogFooter className="print:hidden">
            <a
              href={`/print/orders/${order.id}?type=${type}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "ghost", className: "sm:mr-auto" })}
            >
              <ExternalLink data-icon="inline-start" />
              Abrir en pestaña
            </a>
            {phone ? (
              <a
                href={`${whatsappUrl(phone)}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <MessageCircle data-icon="inline-start" className="text-status-good" />
                WhatsApp
              </a>
            ) : (
              <Button variant="outline" disabled title="El cliente no tiene teléfono registrado">
                <MessageCircle data-icon="inline-start" />
                Sin WhatsApp
              </Button>
            )}
            <Button onClick={() => window.print()}>
              <Printer data-icon="inline-start" />
              Imprimir / Guardar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
