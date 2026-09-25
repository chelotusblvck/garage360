import { Eye, LogOut } from "lucide-react";
import { endSupportSession } from "@/app/actions/admin";
import { DiagnosticsButton } from "@/components/admin/diagnostics-dialog";
import { Button } from "@/components/ui/button";
import type { SupportSession } from "@/lib/auth";

/**
 * Franja fija del modo soporte: el superadmin ve el panel del taller sin poder
 * modificarlo. Solo se renderiza con profile.support (exclusivo de superadmin).
 */
export function SupportBanner({ support }: { support: SupportSession }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-zinc-950 px-4 py-2 text-sm text-zinc-50 print:hidden"
    >
      <Eye className="size-4 shrink-0 text-brand" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-medium">Modo soporte · {support.workshopName}</span>
        <span className="text-zinc-400"> — solo lectura: los cambios están deshabilitados.</span>
      </p>
      <DiagnosticsButton workshopId={support.workshopId} workshopName={support.workshopName} variant="banner" />
      <form action={endSupportSession}>
        <Button type="submit" size="sm" variant="secondary" className="h-7">
          <LogOut data-icon="inline-start" />
          Salir del modo soporte
        </Button>
      </form>
    </div>
  );
}
