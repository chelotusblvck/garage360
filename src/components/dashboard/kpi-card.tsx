import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  /** Línea de contexto bajo el valor (delta, desglose, etc.). */
  footer: React.ReactNode;
  /** Resalta la tarjeta cuando requiere atención. */
  tone?: "default" | "critical";
};

export function KpiCard({ title, value, icon: Icon, footer, tone = "default" }: KpiCardProps) {
  return (
    <Card
      className={cn(
        "gap-3",
        tone === "critical" && "ring-status-critical/30 bg-status-critical/[0.03]"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground",
            tone === "critical" && "bg-status-critical/10 text-status-critical"
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="grid gap-1.5">
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <div className="text-xs text-muted-foreground">{footer}</div>
      </CardContent>
    </Card>
  );
}
