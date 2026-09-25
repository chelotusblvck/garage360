import { BILLING_STATUS_LABEL, type BillingStatus } from "@/lib/billing/shared";
import { cn } from "@/lib/utils";

const TONE: Record<BillingStatus, { pill: string; dot: string }> = {
  current: { pill: "bg-status-good/10 text-status-good", dot: "bg-status-good" },
  pending: { pill: "bg-status-warning/15 text-status-serious", dot: "bg-status-warning" },
  overdue: { pill: "bg-status-critical/10 text-status-critical", dot: "bg-status-critical" },
  suspended: { pill: "bg-foreground text-background", dot: "bg-background" },
};

/** Estado de cobro del taller: Al día · Pendiente · En Mora · Suspendido. */
export function BillingStatusBadge({ status, className }: { status: BillingStatus; className?: string }) {
  const tone = TONE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone.pill, className)}>
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
      {BILLING_STATUS_LABEL[status]}
    </span>
  );
}

/** "2026-10-12" → "12-10-2026". */
export const formatDueDate = (key: string) => key.split("-").reverse().join("-");
