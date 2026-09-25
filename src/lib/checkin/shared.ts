import type { DemoShot } from "@/lib/demo/photos";
import type { CheckInPhotoSlot, FuelLevel } from "@/lib/validations/schemas";

/* Etiquetas del asistente de recepción, compartidas por cliente y servidor. */

export const FUEL_LEVELS: FuelLevel[] = ["reserve", "quarter", "half", "three_quarters", "full"];

export const FUEL_LEVEL_LABEL: Record<FuelLevel, string> = {
  reserve: "Reserva",
  quarter: "1/4",
  half: "1/2",
  three_quarters: "3/4",
  full: "Lleno",
};

/** Barras encendidas del indicador (de 0 a 4). */
export const FUEL_LEVEL_BARS: Record<FuelLevel, number> = {
  reserve: 0,
  quarter: 1,
  half: 2,
  three_quarters: 3,
  full: 4,
};

export const CHECK_IN_SLOT_COPY: Record<CheckInPhotoSlot, { title: string; hint: string }> = {
  dashboard: { title: "Tablero / kilometraje", hint: "Odómetro legible y testigos encendidos" },
  left: { title: "Costado izquierdo", hint: "Moto completa, de rueda a rueda" },
  right: { title: "Costado derecho", hint: "Moto completa, de rueda a rueda" },
  damage: { title: "Daño preexistente", hint: "Rayones, golpes o piezas faltantes" },
};

/** Descripción con la que se guarda cada foto de recepción. */
export function checkInCaption(slot: CheckInPhotoSlot, note: string | null) {
  if (slot === "damage") return note ? `Daño preexistente: ${note}` : "Daño preexistente";
  return note ? `${CHECK_IN_SLOT_COPY[slot].title} · ${note}` : CHECK_IN_SLOT_COPY[slot].title;
}

/** Notas rápidas para daños frecuentes. */
export const DAMAGE_PRESETS = [
  "Carenado rayado",
  "Estanque rayado",
  "Espejo roto",
  "Manilla doblada",
  "Pintura saltada",
  "Llanta rayada",
  "Asiento roto",
  "Direccional quebrado",
] as const;

/** Prefijo de las fotos de prueba del modo demo ("sample:dashboard"). */
export const SAMPLE_PHOTO_PREFIX = "sample:";

/** Ilustración usada como "foto de prueba" de cada toma (modo demo). */
export const SAMPLE_SHOT: Record<CheckInPhotoSlot, DemoShot> = {
  dashboard: "odometer",
  left: "side",
  right: "side-right",
  damage: "damage",
};
