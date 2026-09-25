import { cookies } from "next/headers";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireStaff } from "@/lib/auth";
import { getInventoryRepository } from "@/lib/inventory/repository";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const { lowCount, outCount } = await getInventoryRepository().stats();

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        profile={profile}
        badges={{ "/dashboard/inventory": lowCount + outCount }}
      />
      <SidebarInset>
        <DashboardHeader isDemo={profile.isDemo} />
        <div className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
