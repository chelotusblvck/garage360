import "server-only";
import { createHash } from "node:crypto";
import type { UserRole } from "@/lib/validations/schemas";
import { PRIMARY_WORKSHOP_ID } from "@/lib/workshops/shared";

/* Cuentas del modo demo (sin Supabase). Las fijas usan DEMO_PASSWORD; las activadas con enlace, la suya. */

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

/** Cuentas creadas al activar un taller nuevo (viven en memoria hasta reiniciar el servidor). */
type RuntimeAccount = DemoAccount & { passwordHash: string };
const store = globalThis as typeof globalThis & { __motoopsDemoRuntimeAccounts?: RuntimeAccount[] };
const runtimeAccounts = () => (store.__motoopsDemoRuntimeAccounts ??= []);

const hashPassword = (password: string) => createHash("sha256").update(`motoops-demo:${password}`).digest("hex");

export function findDemoAccount(email: string): DemoAccount | null {
  const key = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === key) ?? runtimeAccounts().find((a) => a.email === key) ?? null;
}

export function verifyDemoPassword(account: DemoAccount, password: string) {
  const runtime = runtimeAccounts().find((a) => a.email === account.email);
  return runtime ? runtime.passwordHash === hashPassword(password) : password === DEMO_PASSWORD;
}

/** Alta de la cuenta del admin al usar su enlace de activación (modo demo). */
export function registerDemoAccount(account: Omit<DemoAccount, "hint">, password: string): DemoAccount {
  const created: RuntimeAccount = { ...account, hint: "Cuenta activada con enlace", passwordHash: hashPassword(password) };
  runtimeAccounts().push(created);
  return created;
}
