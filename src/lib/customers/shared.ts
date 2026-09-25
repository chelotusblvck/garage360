import { formatPlate } from "@/lib/format";
import { cleanRut } from "@/lib/rut";
import { normalizeText } from "@/lib/utils";
import type { PhotoStage } from "@/lib/validations/schemas";

/*
 * Búsqueda de clientes compartida por el repositorio demo y el filtro
 * instantáneo del listado (cliente). Se busca por nombre, RUT (con o sin
 * puntos), email, teléfono, comuna, patente y marca / modelo de sus motos.
 */

const SEPARATORS = /[.\-·+()]/g;

export function customerSearchText(
  customer: { name: string; rut: string | null; email: string | null; phone: string | null; city: string | null },
  motorcycles: { brand: string; model: string; plate: string }[]
) {
  const parts = [
    customer.name,
    customer.rut ?? "",
    customer.rut ? cleanRut(customer.rut) : "",
    customer.email ?? "",
    customer.phone?.replace(/\D/g, "") ?? "",
    customer.city ?? "",
    ...motorcycles.flatMap((m) => [m.plate, formatPlate(m.plate), m.brand, m.model, `${m.brand} ${m.model}`]),
  ];
  return normalizeText(parts.join(" "));
}

/** Todas las palabras de la búsqueda deben aparecer (en cualquier orden). */
export function matchesCustomerSearch(haystack: string, query: string) {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  return tokens.every((token) => {
    const bare = token.replace(SEPARATORS, "");
    return haystack.includes(token) || (bare.length > 0 && haystack.includes(bare));
  });
}

/** Sugerencias del campo "Comuna" (Gran Santiago). */
export const SANTIAGO_COMUNAS = [
  "Santiago Centro",
  "Providencia",
  "Las Condes",
  "Vitacura",
  "Lo Barnechea",
  "Ñuñoa",
  "La Reina",
  "Peñalolén",
  "Macul",
  "La Florida",
  "Puente Alto",
  "San Miguel",
  "Estación Central",
  "Maipú",
  "Huechuraba",
  "Recoleta",
  "Independencia",
  "Colina",
] as const;

/** Marcas sugeridas al registrar una moto (especialidad del taller primero). */
export const MOTORCYCLE_BRANDS = ["Ducati", "Triumph", "Yamaha", "BMW", "KTM", "Honda", "Kawasaki", "Suzuki", "Aprilia", "MV Agusta"] as const;

export const PHOTO_STAGES: PhotoStage[] = ["reception", "in_progress", "delivery"];

export const PHOTO_STAGE_LABEL: Record<PhotoStage, string> = {
  reception: "Recepción (ingreso)",
  in_progress: "Trabajo en proceso",
  delivery: "Entrega",
};

export const PHOTO_STAGE_SHORT: Record<PhotoStage, string> = {
  reception: "Recepción",
  in_progress: "En proceso",
  delivery: "Entrega",
};

const COLOR_SWATCHES: [RegExp, string][] = [
  [/roj|red|rosso/i, "#c1121f"],
  [/negr|black|nero/i, "#1c1f26"],
  [/gris|titan|grey|gray|plat/i, "#6b7280"],
  [/blanc|white|bianc/i, "#e5e7eb"],
  [/amarill|yellow|giall/i, "#eab308"],
  [/azul|blue|blu/i, "#1d4ed8"],
  [/verde|green|militar/i, "#4d7c0f"],
  [/naranj|orange/i, "#ea580c"],
];

/** Color aproximado para el nombre libre ("Rojo Ducati", "Gris Titanio"…). */
export function colorSwatch(color: string | null) {
  if (!color) return null;
  return COLOR_SWATCHES.find(([pattern]) => pattern.test(color))?.[1] ?? null;
}

/** Enlace de WhatsApp (wa.me) a partir de un teléfono chileno. */
export function whatsappUrl(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("9")) digits = `56${digits}`;
  return `https://wa.me/${digits}`;
}
