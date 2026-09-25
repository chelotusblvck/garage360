import type { Metadata } from "next";
import { getCustomers } from "@/app/actions/customers";
import { PageHeader } from "@/components/dashboard/page-header";
import { formatNumber } from "@/lib/format";
import { customerFiltersSchema } from "@/lib/validations/schemas";
import { CustomersView } from "./_components/customers-view";

export const metadata: Metadata = { title: "Clientes" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CustomersPage({ searchParams }: PageProps<"/dashboard/customers">) {
  const params = await searchParams;
  const { q } = customerFiltersSchema.parse({ q: first(params.q) });
  // Se cargan todos y el filtro corre en el navegador (resultados al instante).
  const customers = await getCustomers();
  const motorcycles = customers.reduce((sum, c) => sum + c.motorcycles.length, 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader
        title="Clientes"
        description={`${formatNumber(customers.length)} clientes · ${formatNumber(motorcycles)} motos registradas`}
      />
      <CustomersView customers={customers} initialQuery={q ?? ""} openNew={first(params.new) === "1"} />
    </div>
  );
}
