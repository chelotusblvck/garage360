"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/logo";

const MESSAGES = [
  "Cargando módulo de taller…",
  "Sincronizando inventario y ventas…",
  "Preparando órdenes de trabajo…",
  "Personalizando tu experiencia…",
];

/** Duración de la barra (igual que --animate-splash-progress en globals.css). */
const DURATION_MS = 1500;
const STEP_MS = DURATION_MS / MESSAGES.length;

/**
 * Pantalla de carga al entrar al panel del taller. Va en el layout de
 * (dashboard), que persiste entre navegaciones internas: aparece al iniciar
 * sesión o al recargar, no al moverse entre módulos. La barra y el fundido de
 * salida son animaciones CSS (globals.css); al terminar el fundido el
 * componente se desmonta. Con prefers-reduced-motion no se muestra.
 */
export function DashboardSplashLoader() {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers = MESSAGES.slice(1).map((_, i) => setTimeout(() => setIndex(i + 1), STEP_MS * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, []);

  if (done) return null;

  return (
    <div
      role="status"
      aria-busy="true"
      className="fixed inset-0 z-50 flex animate-splash-out flex-col items-center justify-center gap-8 bg-neutral-950 px-6 text-white motion-reduce:hidden"
      onAnimationEnd={(e) => {
        // animationend de los hijos (barra, mensajes) también burbujea hasta aquí.
        if (e.target === e.currentTarget) setDone(true);
      }}
    >
      <div className="relative grid place-items-center">
        {/* Brillo sutil de marca detrás del logo. */}
        <div aria-hidden className="absolute size-48 rounded-full bg-brand/25 blur-3xl" />
        <Wordmark size="xl" tagline className="relative items-center" />
      </div>
      <div className="grid w-full max-w-64 justify-items-center gap-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full origin-left animate-splash-progress rounded-full bg-brand" />
        </div>
        <p key={index} className="animate-in text-center text-xs text-zinc-400 duration-300 fade-in slide-in-from-bottom-1">
          {MESSAGES[index]}
        </p>
      </div>
    </div>
  );
}
