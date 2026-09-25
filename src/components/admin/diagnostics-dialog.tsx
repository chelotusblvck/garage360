"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  Braces,
  CircleCheck,
  CircleMinus,
  CircleX,
  ClipboardCopy,
  LoaderCircle,
  RefreshCw,
  Search,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { getTenantDiagnostics } from "@/app/actions/diagnostics";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { diagnosticsJson, diagnosticsMarkdown } from "@/lib/logs/report";
import { LOG_LEVELS, type HealthStatus, type LogLevel, type SystemLog, type TenantDiagnostics } from "@/lib/logs/types";
import { cn, normalizeText } from "@/lib/utils";

/** Refresco del visor mientras «En vivo» está activo. */
const LIVE_INTERVAL_MS = 5000;

const LEVEL_STYLE: Record<LogLevel, string> = {
  error: "bg-status-critical/10 text-status-critical ring-status-critical/25",
  warn: "bg-status-warning/15 text-status-serious ring-status-warning/30",
  info: "bg-muted text-muted-foreground ring-foreground/10",
};

const HEALTH_ICON: Record<HealthStatus, { icon: typeof CircleCheck; className: string; label: string }> = {
  ok: { icon: CircleCheck, className: "text-status-good", label: "OK" },
  warn: { icon: TriangleAlert, className: "text-status-serious", label: "Atención" },
  error: { icon: CircleX, className: "text-status-critical", label: "Falla" },
  na: { icon: CircleMinus, className: "text-muted-foreground", label: "No aplica" },
};

type Props = {
  workshopId: string;
  workshopName: string;
  /** "banner": sobre la franja oscura del modo soporte. */
  variant?: "outline" | "banner";
};

/**
 * Botón «Diagnóstico Dev» + panel de soporte (logs, health check, reporte).
 * Solo se renderiza en vistas de superadmin, y la acción que trae los datos
 * vuelve a exigir el rol en el servidor.
 */
export function DiagnosticsButton({ workshopId, workshopName, variant = "outline" }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={variant === "banner" ? "secondary" : "ghost"}
        className={variant === "banner" ? "h-7" : undefined}
        onClick={() => setOpen(true)}
        aria-label={`Diagnóstico Dev de ${workshopName}`}
      >
        <Stethoscope data-icon="inline-start" />
        Diagnóstico Dev
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-5xl">
          {open ? <DiagnosticsPanel workshopId={workshopId} workshopName={workshopName} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DiagnosticsPanel({ workshopId, workshopName }: { workshopId: string; workshopName: string }) {
  const [data, setData] = useState<TenantDiagnostics | null>(null);
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState(true);
  const [tab, setTab] = useState<"logs" | "health">("logs");
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const next = await getTenantDiagnostics(workshopId);
        setData(next);
        setFailed(next === null);
      } catch {
        setFailed(true);
      }
    });
  }, [workshopId]);

  useEffect(() => {
    refresh();
    if (!live) return;
    const timer = setInterval(refresh, LIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [live, refresh]);

  const logs = useMemo(() => data?.logs ?? [], [data]);
  const counts = useMemo(() => {
    const c: Record<LogLevel, number> = { error: 0, warn: 0, info: 0 };
    for (const l of logs) c[l.level]++;
    return c;
  }, [logs]);
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  const visible = logs.filter(
    (l) =>
      (level === "all" || l.level === level) &&
      terms.every((t) => normalizeText(`${l.message} ${l.source} ${l.stack_trace ?? ""} ${JSON.stringify(l.metadata)}`).includes(t))
  );
  const filtered = level !== "all" || terms.length > 0;
  const worst = data?.health.some((h) => h.status === "error") ? "error" : data?.health.some((h) => h.status === "warn") ? "warn" : "ok";

  async function copy(kind: "markdown" | "json") {
    if (!data) return;
    const text = kind === "markdown" ? diagnosticsMarkdown(data, visible) : diagnosticsJson(data, visible);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Reporte ${kind === "markdown" ? "Markdown" : "JSON"} copiado · ${visible.length} logs`);
    } catch {
      toast.error("El navegador bloqueó el portapapeles");
    }
  }

  return (
    <>
      <DialogHeader className="gap-3 pr-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="size-4 text-brand" aria-hidden />
              Panel de Soporte & Logs · {workshopName}
            </DialogTitle>
            <DialogDescription>
              {data
                ? `${data.mode === "demo" ? "Modo demo (en memoria)" : "Supabase"} · actualizado ${formatDateTime(new Date(data.generatedAt))}`
                : "Cargando diagnóstico…"}
            </DialogDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={live}
              onClick={() => setLive((v) => !v)}
              title="Refresca cada 5 segundos"
            >
              <span className={cn("size-2 rounded-full", live ? "animate-pulse bg-status-good" : "bg-muted-foreground")} aria-hidden />
              {live ? "En vivo" : "Pausado"}
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={refresh} disabled={loading} aria-label="Actualizar ahora">
              {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => copy("json")} disabled={!data}>
              <Braces data-icon="inline-start" />
              JSON
            </Button>
            <Button type="button" size="sm" onClick={() => copy("markdown")} disabled={!data}>
              <ClipboardCopy data-icon="inline-start" />
              Copiar reporte para Dev
            </Button>
          </div>
        </div>

        <div role="tablist" aria-label="Secciones del diagnóstico" className="flex gap-1 border-b">
          {(
            [
              ["logs", `Logs${data ? ` (${logs.length})` : ""}`],
              ["health", "Health check"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                tab === key ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {key === "health" && data ? (
                <span
                  className={cn(
                    "size-2 rounded-full",
                    worst === "error" ? "bg-status-critical" : worst === "warn" ? "bg-status-warning" : "bg-status-good"
                  )}
                  aria-hidden
                />
              ) : null}
              {label}
            </button>
          ))}
        </div>
      </DialogHeader>

      <div className="-mx-4 min-h-0 overflow-y-auto px-4 pb-1">
        {failed && !data ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            No se pudo cargar el diagnóstico del taller.
          </p>
        ) : !data ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin" aria-label="Cargando" />
          </div>
        ) : tab === "health" ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.health.map((h) => {
              const s = HEALTH_ICON[h.status];
              return (
                <li key={h.key} className="grid content-start gap-1.5 rounded-xl border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <s.icon className={cn("size-4 shrink-0", s.className)} aria-hidden />
                    {h.label}
                    <span className={cn("ml-auto text-xs font-normal", s.className)}>{s.label}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{h.summary}</p>
                  {h.details.length ? (
                    <ul className="grid gap-1 font-mono text-xs text-muted-foreground">
                      {h.details.map((d) => (
                        <li key={d}>· {d}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label="Filtrar por nivel" className="flex gap-1 rounded-lg bg-muted p-0.5">
                {(["all", ...LOG_LEVELS] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={level === l}
                    onClick={() => setLevel(l)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      level === l ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {l === "all" ? `Todos · ${logs.length}` : `${l} · ${counts[l]}`}
                  </button>
                ))}
              </div>
              <div className="relative min-w-48 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar en mensaje, stack o metadata…"
                  aria-label="Buscar en los logs"
                  className="h-8 pl-8"
                />
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {filtered ? "Ningún log coincide con los filtros." : "Sin logs registrados para este taller."}
              </p>
            ) : (
              <ul className="grid divide-y rounded-xl border">
                {visible.map((log) => (
                  <LogRow key={log.id} log={log} open={expanded === log.id} onToggle={() => setExpanded((id) => (id === log.id ? null : log.id))} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function LogRow({ log, open, onToggle }: { log: SystemLog; open: boolean; onToggle: () => void }) {
  const hasMetadata = Object.keys(log.metadata).length > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:grid-cols-[9.5rem_3.75rem_7rem_minmax(0,1fr)]"
      >
        <span className="col-span-3 font-mono text-xs text-muted-foreground tabular-nums sm:col-span-1">
          {formatDateTime(new Date(log.created_at))}
        </span>
        <span className={cn("w-fit rounded px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase ring-1", LEVEL_STYLE[log.level])}>
          {log.level}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{log.source}</span>
        <span className={cn("min-w-0", open ? "break-words" : "truncate")}>{log.message}</span>
      </button>
      {open ? (
        <div className="grid gap-3 px-3 pb-3">
          {log.stack_trace ? <CodeBlock title="Stack trace" code={log.stack_trace} /> : null}
          {hasMetadata ? <CodeBlock title="Metadata" code={JSON.stringify(log.metadata, null, 2)} /> : null}
          {!log.stack_trace && !hasMetadata ? <p className="text-xs text-muted-foreground">Sin stack trace ni metadata.</p> : null}
          <p className="font-mono text-[11px] text-muted-foreground">id {log.id}</p>
        </div>
      ) : null}
    </li>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <pre className="max-h-72 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
