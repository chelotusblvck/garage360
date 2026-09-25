import { redirect } from "next/navigation";
import { getCurrentProfile, homePathFor } from "@/lib/auth";

/**
 * Raíz: sin sesión → login; con sesión, a la pantalla de cada rol (el taller
 * pasa por /onboarding si aún no lo completa, desde el layout del panel).
 * La portada pública para clientes vive en /inicio.
 */
export default async function RootPage() {
  const profile = await getCurrentProfile();
  redirect(profile ? homePathFor(profile) : "/login");
}
