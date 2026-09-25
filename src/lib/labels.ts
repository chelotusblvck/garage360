import type {
  AppointmentStatus,
  ServiceType,
  WorkOrderStatus,
} from "@/lib/validations/schemas";

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  maintenance: "Mantenimiento",
  inspection: "Revisión",
  repair: "Reparación",
};

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Por confirmar",
  confirmed: "Confirmada",
  completed: "Atendida",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

/** Textos de la agenda pública (lenguaje del cliente). */
export const PUBLIC_SERVICE_COPY: Record<ServiceType, { title: string; description: string }> = {
  maintenance: {
    title: "Mantenimiento por KM",
    description: "Service periódico según el kilometraje: aceite, filtros, bujías, ajustes y lubricación.",
  },
  inspection: {
    title: "Inspección / Revisión",
    description: "Chequeo general antes de un viaje, una compra o la verificación técnica.",
  },
  repair: {
    title: "Diagnóstico por falla",
    description: "Ruidos, pérdidas, fallas de arranque o eléctricas. Revisamos y te pasamos presupuesto.",
  },
};

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  open: "Recepcionada",
  in_progress: "En proceso",
  waiting_parts: "Esperando repuestos",
  completed: "Lista para entrega",
  delivered: "Entregada",
  cancelled: "Cancelada",
};
