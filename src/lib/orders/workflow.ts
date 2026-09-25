import type { WorkOrderStatus } from "@/lib/validations/schemas";

/*
 * Máquina de estados de la OT. Refleja work_order_transition_allowed() en
 * supabase/schema.sql: si cambias una, cambia la otra.
 *
 *   Recepcionada ⇄ En proceso ⇄ Esperando repuestos ⇄ Lista para entrega → Entregada
 *   (cualquier estado activo) → Cancelada → Recepcionada
 */

export const ACTIVE_STATUSES = ["open", "in_progress", "waiting_parts", "completed"] as const satisfies WorkOrderStatus[];

/** Columnas del tablero Kanban, en orden de flujo. */
export const BOARD_COLUMNS = [...ACTIVE_STATUSES, "delivered"] as const satisfies WorkOrderStatus[];

export const ALL_STATUSES: WorkOrderStatus[] = [...BOARD_COLUMNS, "cancelled"];

const isActive = (s: WorkOrderStatus) => (ACTIVE_STATUSES as readonly WorkOrderStatus[]).includes(s);

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  if (from === to) return false;
  if (isActive(from) && (isActive(to) || to === "cancelled")) return true;
  if (from === "completed" && to === "delivered") return true;
  if (from === "cancelled" && to === "open") return true;
  return false;
}

export function nextStatuses(from: WorkOrderStatus): WorkOrderStatus[] {
  return ALL_STATUSES.filter((to) => canTransition(from, to));
}

/** Entregadas y canceladas no admiten cambios de repuestos / mano de obra. */
export const isEditable = (status: WorkOrderStatus) => status !== "delivered" && status !== "cancelled";

export const formatFolio = (number: number) => `OT-${String(number).padStart(4, "0")}`;

/**
 * "#34", "OT-34", "ot 0034" → 34 (búsqueda exacta por folio).
 * Un número suelto ("34") NO cuenta: puede ser parte de una patente.
 */
export function parseFolioQuery(query: string): number | null {
  const match = query.trim().match(/^(?:#|ot[\s-]?)0*(\d{1,9})$/i);
  return match ? Number(match[1]) : null;
}
