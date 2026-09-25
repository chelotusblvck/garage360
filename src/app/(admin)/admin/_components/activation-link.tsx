"use client";

import { useSyncExternalStore } from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const noop = () => () => {};

/** Enlace de activación listo para copiar o compartir (se muestra una sola vez). */
export function ActivationLink({ path, email, workshopName }: { path: string; email: string; workshopName: string }) {
  // El origen solo existe en el navegador; en el servidor queda la ruta relativa.
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = origin + path;
  const message = `Hola, te damos la bienvenida a MotoOps. Activa la cuenta de administrador de ${workshopName} aquí (vence en 7 días): ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("El navegador bloqueó el portapapeles: copia el enlace a mano");
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border bg-muted/40 p-4">
      <div className="grid gap-1">
        <p className="text-sm font-medium">Enlace de invitación / activación</p>
        <p className="text-xs text-muted-foreground">
          Para <span className="font-medium text-foreground">{email}</span>. Vence en 7 días y sirve una sola vez; si se
          pierde, genera uno nuevo desde «Facturación» del taller.
        </p>
      </div>
      <Input value={url} readOnly aria-label="Enlace de activación" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy}>
          <Copy data-icon="inline-start" />
          Copiar enlace de invitación / activación
        </Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
          <MessageCircle data-icon="inline-start" className="text-status-good" />
          WhatsApp
        </a>
        <a
          href={`mailto:${email}?subject=${encodeURIComponent(`Activa tu cuenta de ${workshopName} en MotoOps`)}&body=${encodeURIComponent(message)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <Mail data-icon="inline-start" />
          Email
        </a>
      </div>
    </div>
  );
}
