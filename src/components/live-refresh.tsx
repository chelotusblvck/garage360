"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const CHANNEL_NAME = "motoops:sales";

/** Avisa a otras pestañas del navegador que hubo una venta (POS / tienda). */
export function broadcastSalesChange() {
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage("changed");
    channel.close();
  } catch {
    // BroadcastChannel no disponible: el sondeo periódico cubre el caso.
  }
}

/**
 * Mantiene la página del servidor al día sin recargar:
 *  - Supabase Realtime: cambios en `sales` y `products` (stock).
 *  - Ventas hechas en otra pestaña del mismo navegador (BroadcastChannel).
 *  - Respaldo: sondeo mientras la pestaña está visible y al volver a ella.
 */
export function LiveRefresh({ className }: { className?: string }) {
  const router = useRouter();

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 400);
    };

    let broadcast: BroadcastChannel | null = null;
    try {
      broadcast = new BroadcastChannel(CHANNEL_NAME);
      broadcast.onmessage = refresh;
    } catch {
      broadcast = null;
    }

    const realtime = getSupabaseEnv() ? createClient() : null;
    const subscription = realtime
      ?.channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products" }, refresh)
      .subscribe();

    const poll = setInterval(
      () => {
        if (document.visibilityState === "visible") refresh();
      },
      realtime ? 60_000 : 15_000
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      broadcast?.close();
      if (realtime && subscription) void realtime.removeChannel(subscription);
    };
  }, [router]);

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-good/60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-status-good" />
      </span>
      En vivo
    </span>
  );
}
