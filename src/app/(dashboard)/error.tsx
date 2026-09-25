"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { reportClientError } from "@/app/actions/diagnostics";
import { Button } from "@/components/ui/button";

/**
 * Errores ya reportados en esta pestaña: un mismo error que se repite al
 * reintentar o re-renderizar se envía una sola vez (el servidor además limita
 * a 5 por minuto por sesión).
 */
const reported = new Set<string>();

/** Error inesperado en el panel: se reporta a system_logs (source client_error) y se ofrece reintentar. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const key = error.digest ?? `${error.message}|${window.location.pathname}`;
    if (reported.has(key)) return;
    reported.add(key);
    void reportClientError({
      message: error.message || "Error sin mensaje",
      stack: error.stack ?? null,
      digest: error.digest ?? null,
      url: window.location.pathname + window.location.search,
    });
  }, [error]);

  return (
    <div className="grid min-h-[60svh] place-items-center p-6">
      <div className="grid max-w-md justify-items-center gap-3 text-center">
        <TriangleAlert className="size-8 text-status-critical" aria-hidden />
        <h1 className="text-lg font-semibold">Algo salió mal en esta pantalla</h1>
        <p className="text-sm text-muted-foreground">
          El error quedó registrado para el equipo de soporte
          {error.digest ? (
            <>
              {" "}
              (código <code className="font-mono">{error.digest}</code>)
            </>
          ) : null}
          . Puedes reintentar o volver más tarde.
        </p>
        <Button onClick={reset}>
          <RotateCcw data-icon="inline-start" />
          Reintentar
        </Button>
      </div>
    </div>
  );
}
