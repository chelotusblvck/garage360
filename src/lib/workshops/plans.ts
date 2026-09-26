/*
 * Planes de suscripción y modalidades de implementación (alta de talleres en
 * /admin), equipamiento y cotizaciones (/login). Precios en CLP con IVA
 * incluido: este es el único lugar donde viven.
 */

import { SALES_TAX } from "@/lib/business";

export const PLAN_KEYS = ["starter", "pro", "enterprise"] as const;
export const SETUP_TYPES = ["diy", "turnkey"] as const;

export type PlanKey = (typeof PLAN_KEYS)[number];
export type SetupType = (typeof SETUP_TYPES)[number];

export const PLANS: Record<PlanKey, { label: string; monthly: number; description: string; features: string[] }> = {
  starter: {
    label: "Starter",
    monthly: 29_990,
    description: "Talleres pequeños que parten con órdenes y agenda.",
    features: ["Hasta 3 usuarios", "OTs, agenda e inventario", "Comprobantes con fotos"],
  },
  pro: {
    label: "Pro",
    monthly: 59_990,
    description: "El taller completo: mostrador, tienda online y métricas.",
    features: ["Hasta 10 usuarios", "POS y tienda online", "Métricas en vivo"],
  },
  enterprise: {
    label: "Enterprise",
    monthly: 119_990,
    description: "Varios mecánicos, alto volumen y soporte prioritario.",
    features: ["Usuarios ilimitados", "Soporte prioritario", "Todo lo de Pro"],
  },
};

export const SETUPS: Record<SetupType, { label: string; short: string; fee: number; description: string }> = {
  diy: {
    label: "Autogestión / DIY",
    short: "DIY",
    fee: 0,
    description: "El cliente se configura solo con el asistente de onboarding.",
  },
  turnkey: {
    label: "Llave en Mano / VIP",
    short: "VIP",
    fee: 150_000,
    description: "Carga masiva de datos (clientes, motos, inventario) + capacitación en vivo.",
  },
};

/** Cobro inicial: primera mensualidad + fee de setup (pago único) si corresponde. */
export function initialCharge(plan: PlanKey, setup: SetupType) {
  const monthly = PLANS[plan].monthly;
  const setupFee = SETUPS[setup].fee;
  return { monthly, setupFee, total: monthly + setupFee };
}

// ---------------------------------------------------------------------------
// Equipamiento (catálogo público y cotizaciones de /login)
// ---------------------------------------------------------------------------

export const HARDWARE_KEYS = ["tablet_rugged_10", "printer_thermal_80", "pos_smart_c2c"] as const;
export type HardwareKey = (typeof HARDWARE_KEYS)[number];

/** Precios sugeridos por unidad (CLP, IVA incluido, pago único). */
export const HARDWARE: Record<HardwareKey, { label: string; price: number; description: string; features: string[] }> = {
  tablet_rugged_10: {
    label: 'Tablet Ruda 10"',
    price: 249_990,
    description: "Para la recepción con fotos y las OTs en el box: resiste golpes, grasa y polvo.",
    features: ["Certificación IP68", "Carcasa antigolpes", "Cámara 13 MP"],
  },
  printer_thermal_80: {
    label: "Impresora Térmica 80mm",
    price: 89_990,
    description: "Tickets del mostrador y comprobantes de OT al instante.",
    features: ["USB + Bluetooth", "Corte automático", "Sin tinta"],
  },
  pos_smart_c2c: {
    label: "POS Smart C2C",
    price: 129_990,
    description: "Cobra con tarjeta de débito y crédito desde el punto de venta.",
    features: ["Chip y contactless", "Impresora integrada", "Conexión 4G y Wi-Fi"],
  },
};

/** Tope de unidades por equipo en una cotización. */
export const MAX_HARDWARE_UNITS = 10;

export type HardwareLine = { sku: HardwareKey; qty: number };

/** Monto con IVA incluido → neto + IVA. */
export function splitTax(total: number) {
  const net = Math.round(total / (1 + SALES_TAX.rate));
  return { net, tax: total - net, total };
}

/**
 * Cotización: pago inicial (setup + equipamiento) y mensualidad recurrente,
 * ambos con IVA incluido y desglosado. El servidor la recalcula siempre.
 */
export function quoteTotals(plan: PlanKey, setup: SetupType, hardware: HardwareLine[]) {
  const lines = hardware
    .filter((h) => h.qty > 0)
    .map((h) => ({ ...h, label: HARDWARE[h.sku].label, unit: HARDWARE[h.sku].price, subtotal: HARDWARE[h.sku].price * h.qty }));
  const setupFee = SETUPS[setup].fee;
  const hardwareTotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
  return {
    lines,
    setupFee,
    hardwareTotal,
    initial: splitTax(setupFee + hardwareTotal),
    monthly: splitTax(PLANS[plan].monthly),
  };
}
