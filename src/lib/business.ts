/**
 * Datos del taller para comprobantes impresos.
 * TODO: reemplazar por los datos reales (o moverlos a una tabla de configuración).
 */
export const WORKSHOP = {
  name: "MotoOps Taller",
  tagline: "Especialistas en Ducati y motos de alta gama",
  legalName: "MotoOps Servicios Técnicos SpA",
  taxId: "RUT 76.543.210-3",
  address: "Av. Francisco Bilbao 2850, Providencia, Santiago",
  phone: "+56 9 8765 4321",
  email: "taller@motoops.cl",
} as const;

/** Valor hora de mano de obra sugerido al cargar trabajos en una OT (CLP). */
export const DEFAULT_HOURLY_RATE = 45_000;

/**
 * Impuesto en el punto de venta. Los precios del catálogo son finales; en
 * mostrador se puede sumar IVA (p. ej. para emitir factura a una empresa).
 */
export const SALES_TAX = {
  label: "IVA",
  rate: 0.19,
  /** Estado inicial del interruptor "Sumar IVA" en el POS. */
  applyByDefault: false,
} as const;

/** Condiciones de la tienda online mostradas en el checkout. */
export const SHOP = {
  pickupAddress: WORKSHOP.address,
  pickupHours: "Lun a vie 9 a 18 h · Sáb 9 a 13 h",
  deliveryNote: "El costo de despacho se coordina por WhatsApp según la comuna.",
  transferAccount: `Banco de Chile · Cta. Cte. 00-123-45678-09 · MotoOps Servicios Técnicos SpA · ${WORKSHOP.taxId}`,
  maxUnitsPerProduct: 20,
} as const;
