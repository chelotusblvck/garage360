"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut, Store } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Wordmark } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { SessionProfile } from "@/lib/auth";
import { DASHBOARD_NAV, isNavItemActive } from "./nav-config";

const ROLE_LABEL: Record<SessionProfile["role"], string> = {
  admin: "Administrador",
  mechanic: "Mecánico",
  client: "Cliente",
  superadmin: "Superadmin · soporte",
};

/** Iniciales del taller (hasta 2) para el ícono de la barra colapsada. */
function monogram(name: string) {
  const words = name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

type AppSidebarProps = {
  profile: SessionProfile;
  /** Taller que se está viendo (el propio o, en modo soporte, el elegido). */
  workshop: { name: string; logoUrl: string | null };
  /** Contadores por href para mostrar como badge (p. ej. alertas de stock). */
  badges?: Partial<Record<string, number>>;
};

export function AppSidebar({ profile, workshop, badges = {} }: AppSidebarProps) {
  const pathname = usePathname();
  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/dashboard"
          aria-label="MotoOps · inicio del panel"
          className="w-fit rounded-md px-2 pt-2 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
        >
          <Wordmark tagline />
        </Link>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={workshop.name}
              render={<Link href="/dashboard" />}
            >
              {workshop.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo del taller en data URL
                <img src={workshop.logoUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-sidebar-foreground/10" />
              ) : (
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-xs font-bold tracking-tight text-sidebar-accent-foreground ring-1 ring-sidebar-foreground/10"
                >
                  {monogram(workshop.name)}
                </span>
              )}
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">{workshop.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  Panel del taller
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {DASHBOARD_NAV.map((item) => {
                const isActive = isNavItemActive(item, pathname);
                const badge = badges[item.href];
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {badge ? (
                      <SidebarMenuBadge
                        aria-label={`${badge} alertas`}
                        className="bg-status-critical/12 text-status-critical peer-data-active/menu-button:text-status-critical"
                      >
                        {badge}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Ver tienda" render={<Link href="/inicio" />}>
                  <Store />
                  <span>Ver tienda online</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-popup-open:bg-sidebar-accent"
                  />
                }
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{profile.name}</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {ROLE_LABEL[profile.role]}
                    {profile.isDemo ? " · demo" : ""}
                  </span>
                </span>
                <ChevronsUpDown className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <span className="block font-medium text-foreground">{profile.name}</span>
                    <span className="block text-xs">{profile.email}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
