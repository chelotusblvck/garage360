import {
  CalendarClock,
  ChartColumn,
  ClipboardList,
  Package,
  ReceiptText,
  ScanBarcode,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const DASHBOARD_NAV: NavItem[] = [
  {
    title: "Métricas",
    href: "/dashboard",
    icon: ChartColumn,
    description: "KPIs de ventas y servicios del taller",
  },
  {
    title: "Punto de venta",
    href: "/dashboard/pos",
    icon: ScanBarcode,
    description: "Ventas de mostrador: cobro, vuelto y ticket",
  },
  {
    title: "Ventas",
    href: "/dashboard/sales",
    icon: ReceiptText,
    description: "Historial de ventas de mostrador y tienda online",
  },
  {
    title: "Inventario",
    href: "/dashboard/inventory",
    icon: Package,
    description: "Repuestos, stock y alertas de reposición",
  },
  {
    title: "Citas",
    href: "/dashboard/appointments",
    icon: CalendarClock,
    description: "Calendario de mantenimientos y revisiones",
  },
  {
    title: "Órdenes de trabajo",
    href: "/dashboard/orders",
    icon: ClipboardList,
    description: "Seguimiento de trabajos en el taller",
  },
  {
    title: "Clientes",
    href: "/dashboard/customers",
    icon: Users,
    description: "Fichas, motos, hoja de vida y evidencia fotográfica",
  },
];

/** Ruta raíz del panel: solo coincide exacta, si no estaría activa en todas las subrutas. */
const DASHBOARD_ROOT = "/dashboard";

export function isNavItemActive(item: NavItem, pathname: string) {
  if (item.href === DASHBOARD_ROOT) return pathname === DASHBOARD_ROOT;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findNavItem(pathname: string) {
  return DASHBOARD_NAV.find((item) => isNavItemActive(item, pathname));
}
