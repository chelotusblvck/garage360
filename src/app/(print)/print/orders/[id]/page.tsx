import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomerProfile, getWorkOrderPhotos } from "@/app/actions/customers";
import { getWorkOrderDetail } from "@/app/actions/orders";
import { WorkOrderDocument } from "@/components/orders/work-order-document";
import { WORK_ORDER_DOC_TITLE, type WorkOrderDocType } from "@/lib/orders/documents";
import { PrintToolbar } from "./print-toolbar";

export async function generateMetadata({ params, searchParams }: PageProps<"/print/orders/[id]">): Promise<Metadata> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const order = await getWorkOrderDetail(id);
  const type: WorkOrderDocType = sp.type === "invoice" ? "invoice" : "reception";
  return { title: order ? `${WORK_ORDER_DOC_TITLE[type]} ${order.folio}` : "Documento" };
}

export default async function PrintWorkOrderPage({ params, searchParams }: PageProps<"/print/orders/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const type: WorkOrderDocType = sp.type === "invoice" ? "invoice" : "reception";
  const [order, photos] = await Promise.all([
    getWorkOrderDetail(id),
    type === "reception" ? getWorkOrderPhotos(id) : Promise.resolve([]),
  ]);
  if (!order) notFound();
  const profile = await getCustomerProfile(order.customer.id);

  return (
    <>
      <PrintToolbar
        backHref={`/dashboard/orders/${order.id}`}
        otherHref={`/print/orders/${order.id}?type=${type === "invoice" ? "reception" : "invoice"}`}
        otherLabel={type === "invoice" ? "Ver orden de recepción" : "Ver comprobante"}
      />
      <WorkOrderDocument
        type={type}
        order={order}
        customerRut={profile?.rut ?? null}
        photos={photos.filter((p) => p.stage === "reception")}
        issuedAt={new Date()}
      />
    </>
  );
}
