import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { ActivationTicket } from "@/lib/workshops/types";

/*
 * Enlaces de activación de cuenta (/activate?token=…). El token en claro solo
 * existe en el enlace; en la base de datos se guarda su SHA-256, así una
 * filtración de la tabla no permite activar cuentas.
 */

/** Vigencia del enlace. */
export const ACTIVATION_TTL_DAYS = 7;

export const hashActivationToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newActivationToken(): { token: string; ticket: ActivationTicket } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_DAYS * 86_400_000).toISOString();
  return { token, ticket: { tokenHash: hashActivationToken(token), expiresAt } };
}

export const activationPath = (token: string) => `/activate?token=${encodeURIComponent(token)}`;
