import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SupportBanner } from "@/components/dashboard/support-banner";
import { DashboardSplashLoader } from "@/components/ui/dashboard-splash-loader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentWorkshop, requireStaff } from "@/lib/auth";
import { getInventoryRepository } from "@/lib/inventory/repository";
import { workshopBranding } from "@/lib/workshops/shared";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  const workshop = await getCurrentWorkshop();
  // Primera configuración: el admin del taller completa el asistente antes de operar.
  if (!profile.support && profile.role === "admin" && workshop && !workshop.onboarding_completed) {
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const { lowCount, outCount } = await getInventoryRepository().stats();
  const branding = workshopBranding(workshop);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {/* En el layout (no en la página): no se repite al navegar entre módulos. */}
      <DashboardSplashLoader />
      <AppSidebar
        profile={profile}
        workshop={{ name: branding.name, logoUrl: branding.logoUrl }}
        badges={{ "/dashboard/inventory": lowCount + outCount }}
      />
      <SidebarInset>
        {profile.support ? <SupportBanner support={profile.support} /> : null}
        <DashboardHeader isDemo={profile.isDemo} />
        <div className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
