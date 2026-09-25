import { requireStaff } from "@/lib/auth";

/**
 * Documentos imprimibles: sin navegación y fondo blanco. Cada página define
 * su formato con @page (A4 para OTs, rollo de 80 mm para tickets).
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();

  return <div className="min-h-svh bg-muted/60 py-8 print:bg-white print:py-0">{children}</div>;
}
