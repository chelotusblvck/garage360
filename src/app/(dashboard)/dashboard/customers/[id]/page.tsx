import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Camera, IdCard, Mail, MapPin, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import { getCustomerDetail } from "@/app/actions/customers";
import { buttonVariants } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/customers/shared";
import { formatCurrency, formatMonthYear, formatNumber, formatRut } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CustomerWorkspace } from "./_components/customer-workspace";
import { EditCustomerButton } from "./_components/edit-customer-button";
import { PurchasesCard } from "./_components/purchases-card";

export async function generateMetadata({ params }: PageProps<"/dashboard/customers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCustomerDetail(id);
  return { title: detail ? detail.customer.name : "Cliente no encontrado" };
}

export default async function CustomerPage({ params }: PageProps<"/dashboard/customers/[id]">) {
  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  const { customer, motorcycles, history, purchases } = detail;
  // Moto de referencia para los accesos rápidos: la de la visita más reciente.
  const mainMoto = [...motorcycles].sort((a, b) => (b.last_visit_at ?? "").localeCompare(a.last_visit_at ?? ""))[0];
  const plate = mainMoto && motorcycles.length === 1 ? mainMoto.plate : null;

  const billable = history.filter((o) => o.status === "completed" || o.status === "delivered");
  const workshopSpend = billable.reduce((sum, o) => sum + o.total_amount, 0);
  const paidPurchases = purchases.filter((p) => p.status === "paid");
  const shopSpend = paidPurchases.reduce((sum, p) => sum + p.total, 0);
  const visits = history.filter((o) => o.status !== "cancelled").length;
  const inShop = history.filter((o) => ["open", "in_progress", "waiting_parts", "completed"].includes(o.status)).length;

  const mapsUrl =
    customer.address || customer.city
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [customer.address, customer.city, "Santiago, Chile"].filter(Boolean).join(", ")
        )}`
      : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="grid gap-4">
        <Link
          href="/dashboard/customers"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Clientes
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
              {inShop > 0 ? (
                <span className="inline-flex h-6 items-center rounded-full bg-chart-1/10 px-2 text-xs font-medium ring-1 ring-chart-1/25 ring-inset">
                  {inShop === 1 ? "1 moto en el taller" : `${inShop} motos en el taller`}
                </span>
              ) : null}
            </div>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <li className="inline-flex items-center gap-1.5">
                <IdCard className="size-4" aria-hidden />
                {customer.rut ? <span className="font-mono text-foreground">RUT {formatRut(customer.rut)}</span> : "Sin RUT registrado"}
              </li>
              {customer.phone ? (
                <li>
                  <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                    <Phone className="size-4" aria-hidden />
                    {customer.phone}
                  </a>
                </li>
              ) : null}
              {customer.email ? (
                <li>
                  <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                    <Mail className="size-4" aria-hidden />
                    {customer.email}
                  </a>
                </li>
              ) : null}
              {mapsUrl ? (
                <li>
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
                    <MapPin className="size-4" aria-hidden />
                    {[customer.address, customer.city].filter(Boolean).join(", ")}
                  </a>
                </li>
              ) : null}
            </ul>
            <p className="text-xs text-muted-foreground">Cliente desde {formatMonthYear(new Date(customer.created_at))}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {customer.phone ? (
              <a
                href={whatsappUrl(customer.phone)}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", className: "h-9" })}
              >
                <MessageCircle data-icon="inline-start" className="text-status-good" />
                WhatsApp
              </a>
            ) : null}
            <EditCustomerButton customer={customer} />
            <Link
              href={`/dashboard/appointments?new=1${plate ? `&plate=${plate}` : ""}`}
              className={buttonVariants({ variant: "outline", className: "h-9" })}
            >
              <CalendarPlus data-icon="inline-start" />
              Agendar
            </Link>
            <Link href={`/dashboard/orders/new${plate ? `?plate=${plate}` : ""}`} className={buttonVariants({ className: "h-9" })}>
              <Camera data-icon="inline-start" />
              Recepcionar moto
            </Link>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen del cliente">
          <Stat label="Motos" value={formatNumber(motorcycles.length)} detail={motorcycles.map((m) => m.model).join(" · ") || "Sin motos"} />
          <Stat label="Visitas al taller" value={formatNumber(visits)} detail={billable.length === 1 ? "1 trabajo facturado" : `${billable.length} trabajos facturados`} />
          <Stat label="Gastado en taller" value={formatCurrency(workshopSpend)} detail="OTs listas y entregadas" />
          <Stat
            label="Compras tienda / mostrador"
            value={formatCurrency(shopSpend)}
            detail={paidPurchases.length === 1 ? "1 compra" : `${paidPurchases.length} compras`}
          />
        </section>
      </div>

      <CustomerWorkspace detail={detail} />

      <PurchasesCard purchases={purchases} />
    </div>
  );
}

function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon?: LucideIcon }) {
  return (
    <div className="grid gap-1 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
      </span>
      <span className={cn("truncate text-xl font-semibold tracking-tight tabular-nums")}>{value}</span>
      <span className="truncate text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}
