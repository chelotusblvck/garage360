"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import { nextStatuses } from "@/lib/orders/workflow";
import type { WorkOrderStatus } from "@/lib/validations/schemas";
import { useStatusChange } from "./use-status-change";

/** Selector rápido de estado: solo ofrece transiciones válidas. */
export function StatusSelect({ order }: { order: { id: string; folio: string; status: WorkOrderStatus } }) {
  const { change, isPending, confirmDialog } = useStatusChange();
  const options = nextStatuses(order.status);
  // Remonta el select tras cada intento: si se cancela la confirmación,
  // vuelve a mostrar el estado real.
  const [attempt, setAttempt] = useState(0);

  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        key={`${order.status}-${attempt}`}
        aria-label="Cambiar estado de la orden"
        defaultValue={order.status}
        disabled={isPending || options.length === 0}
        onChange={async (e) => {
          await change(order, e.target.value as WorkOrderStatus);
          setAttempt((n) => n + 1);
        }}
        className="min-w-52 [&_select]:h-9"
      >
        <NativeSelectOption value={order.status}>{WORK_ORDER_STATUS_LABEL[order.status]} (actual)</NativeSelectOption>
        {options.map((status) => (
          <NativeSelectOption key={status} value={status}>
            → {WORK_ORDER_STATUS_LABEL[status]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {isPending ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Actualizando" /> : null}
      {confirmDialog}
    </div>
  );
}
