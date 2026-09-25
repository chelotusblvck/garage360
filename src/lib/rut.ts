/**
 * RUT chileno (Rol Único Tributario). Se guarda normalizado como
 * "12345678-9" (sin puntos, DV en mayúscula) y se muestra con formatRut().
 */

/** Solo dígitos y K: "12.345.678-k" → "12345678K". */
export const cleanRut = (rut: string) => rut.replace(/[^0-9kK]/g, "").toUpperCase();

/** Dígito verificador (módulo 11) de un cuerpo numérico. */
export function rutCheckDigit(body: string) {
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  return rest === 11 ? "0" : rest === 10 ? "K" : String(rest);
}

export function isValidRut(rut: string) {
  const clean = cleanRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;
  return rutCheckDigit(clean.slice(0, -1)) === clean.slice(-1);
}

/** "12.345.678-k" → "12345678-K" (asume RUT válido). */
export function normalizeRut(rut: string) {
  const clean = cleanRut(rut);
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}
