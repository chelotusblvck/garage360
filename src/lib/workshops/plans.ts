/*
 * Planes de suscripción y modalidades de implementación (alta de talleres en
 * /admin). Precios en CLP con IVA incluido: este es el único lugar donde viven.
 */

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
