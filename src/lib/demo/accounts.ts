import "server-only";
import type { UserRole } from "@/lib/validations/schemas";
import { PRIMARY_WORKSHOP_ID } from "@/lib/workshops/shared";

/* Cuentas del modo demo (sin Supabase). La contraseña es la misma para todas. */

export const DEMO_PASSWORD = "demo1234";

/** Taller recién registrado: entra al asistente de onboarding. */
export const DEMO_NEW_WORKSHOP_ID = "00000000-0000-0000-0000-000000000002";

export type DemoAccount = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  workshopId: string | null;
  /** Texto de ayuda en la pantalla de login. */
  hint: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "demo-admin",
    email: "admin@motoops.cl",
    name: "Taller Demo",
    role: "admin",
    workshopId: PRIMARY_WORKSHOP_ID,
    hint: "Taller configurado, con datos de ejemplo",
  },
  {
    id: "demo-new",
    email: "nuevo@motoops.cl",
    name: "Carla Muñoz",
    role: "admin",
    workshopId: DEMO_NEW_WORKSHOP_ID,
    hint: "Taller recién registrado: pasa por el onboarding",
  },
  {
    id: "demo-super",
    email: "super@motoops.cl",
    name: "Soporte MotoOps",
    role: "superadmin",
    workshopId: null,
    hint: "Panel de superadministración",
  },
];

export function findDemoAccount(email: string) {
  return DEMO_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase()) ?? null;
}
