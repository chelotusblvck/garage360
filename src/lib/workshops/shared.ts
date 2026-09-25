import { DEFAULT_HOURLY_RATE, SALES_TAX, WORKSHOP } from "@/lib/business";
import { formatRut } from "@/lib/format";
import type { Workshop } from "./types";

/* Talleres: constantes y helpers compartidos por cliente y servidor. */

/**
 * Taller principal. Mientras los datos operativos (OTs, ventas, inventario…)
 * no lleven workshop_id, todos le pertenecen. Mismo id que en supabase/schema.sql.
 */
export const PRIMARY_WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";

export const DEFAULT_RECEPTION_POLICY =
  "El cliente declara que las fotografías reflejan el estado de la unidad al ingreso. El cliente autoriza al taller a " +
  "realizar el diagnóstico de la unidad. Todo trabajo adicional será presupuestado y requerirá aprobación previa. Las " +
  "unidades no retiradas dentro de los 30 días posteriores a su aviso de finalización podrán generar cargos de guarda.";

export const WORKSHOP_SPECIALTIES = [
  "Multimarca",
  "Ducati y alta gama",
  "Off-road y enduro",
  "Scooters y urbanas",
  "Custom y clásicas",
  "Competición",
];

export const STAFF_ROLE_LABEL = { mechanic: "Mecánico", admin: "Administrador" } as const;

/** Datos del taller que aparecen en comprobantes, mensajes y el panel. */
export type WorkshopBranding = {
  name: string;
  /** Línea legal del encabezado (razón social · RUT). */
  legalLine: string;
  address: string;
  phone: string;
  email: string | null;
  logoUrl: string | null;
  hourlyRate: number;
  /** Fracción (0.19). Los precios del taller son finales: IVA incluido. */
  taxRate: number;
  receptionPolicy: string;
};

/** Configuración del taller o, si aún no existe, los valores por defecto de lib/business. */
export function workshopBranding(w: Workshop | null): WorkshopBranding {
  if (!w) {
    return {
      name: WORKSHOP.name,
      legalLine: `${WORKSHOP.legalName} · ${WORKSHOP.taxId}`,
      address: WORKSHOP.address,
      phone: WORKSHOP.phone,
      email: WORKSHOP.email,
      logoUrl: null,
      hourlyRate: DEFAULT_HOURLY_RATE,
      taxRate: SALES_TAX.rate,
      receptionPolicy: DEFAULT_RECEPTION_POLICY,
    };
  }
  return {
    name: w.name,
    legalLine: w.rut ? `RUT ${formatRut(w.rut)}` : WORKSHOP.legalName,
    address: [w.address, w.city].filter(Boolean).join(", ") || WORKSHOP.address,
    phone: w.phone ?? WORKSHOP.phone,
    email: w.email,
    logoUrl: w.logo_url,
    hourlyRate: w.hourly_rate,
    taxRate: w.tax_rate,
    receptionPolicy: w.reception_policy ?? DEFAULT_RECEPTION_POLICY,
  };
}

/** 19 → 0.19 (tres decimales, como numeric(4,3) en SQL: 19,5 % → 0.195). */
export const taxRateFromPercent = (percent: number) => Math.round(percent * 10) / 1000;
