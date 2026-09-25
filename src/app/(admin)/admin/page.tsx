import type { Metadata } from "next";
import { ClipboardList, Store, Users, Wallet } from "lucide-react";
import { getGlobalMetrics, getWorkshops } from "@/app/actions/admin";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { isSupabaseConfigured } from "@/lib/env";
import { formatCurrency, formatNumber } from "@/lib/format";
import { NewWorkshopWizard } from "./_components/new-workshop-wizard";
import { WorkshopDirectory } from "./_components/workshop-directory";

export const metadata: Metadata = { title: "Consola" };

export default async function AdminPage() {
  const [metrics, workshops] = await Promise.all([getGlobalMetrics(), getWorkshops()]);
  const pending = metrics.workshops - metrics.onboarded;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Consola de superadministración"
        description="Talleres registrados en la plataforma, soporte e indicadores consolidados."
        actions={<NewWorkshopWizard isDemo={!isSupabaseConfigured()} />}
      />

      <section aria-label="Métricas globales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Talleres registrados"
          value={formatNumber(metrics.workshops)}
          icon={Store}
          footer={
            <>
              {metrics.onboarded} activos · {pending === 1 ? "1 con onboarding pendiente" : `${pending} con onboarding pendiente`}
            </>
          }
        />
        <KpiCard
          title="Usuarios de staff"
          value={formatNumber(metrics.staffUsers)}
          icon={Users}
          footer="Administradores y mecánicos con acceso"
        />
        <KpiCard
          title="Órdenes de trabajo"
          value={formatNumber(metrics.workOrders)}
          icon={ClipboardList}
          footer={<>{metrics.openWorkOrders} abiertas en este momento</>}
        />
        <KpiCard
          title="Volumen de ventas"
          value={formatCurrency(metrics.salesTotal)}
          icon={Wallet}
          footer={<>{formatNumber(metrics.salesCount)} ventas pagadas · mostrador, online y OTs</>}
        />
      </section>

      <WorkshopDirectory workshops={workshops} />
    </div>
  );
}
