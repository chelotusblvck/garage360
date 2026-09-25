"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateWorkOrderStatus } from "@/app/actions/orders";
import { useConfirm } from "@/components/confirm-dialog";
import { WORK_ORDER_STATUS_LABEL } from "@/lib/labels";
import type { WorkOrderStatus } from "@/lib/validations/schemas";

type OrderRef = { id: string; folio: string; status: WorkOrderStatus };

/**
 * Cambio de estado con confirmación para los pasos irreversibles o
 * sensibles (entregar / cancelar) y actualización optimista opcional.
 */
export function useStatusChange() {
  const [confirm, confirmDialog] = useConfirm();
  const [isPending, startTransition] = useTransition();

  async function change(order: OrderRef, to: WorkOrderStatus, onOptimistic?: () => void) {
    if (to === "delivered") {
      const ok = await confirm({
        title: `¿Entregar ${order.folio} al cliente?`,
        description: "La orden quedará cerrada: ya no se podrán agregar ni quitar repuestos o mano de obra.",
        confirmLabel: "Marcar como entregada",
      });
      if (!ok) return;
    }
    if (to === "cancelled") {
      const ok = await confirm({
        title: `¿Cancelar ${order.folio}?`,
        description: "La orden se podrá reabrir más tarde. Si tiene repuestos asignados, primero debes quitarlos para devolverlos al stock.",
        confirmLabel: "Cancelar orden",
        destructive: true,
      });
      if (!ok) return;
    }

    startTransition(async () => {
      onOptimistic?.();
      const result = await updateWorkOrderStatus(order.id, to);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${order.folio}: ${WORK_ORDER_STATUS_LABEL[to]}`);
    });
  }

  return { change, isPending, confirmDialog };
}
