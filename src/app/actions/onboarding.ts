"use server";

import { revalidatePath } from "next/cache";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireWorkshopAdmin } from "@/lib/auth";
import { onboardingSchema } from "@/lib/validations/schemas";
import { getWorkshopRepository } from "@/lib/workshops/repository";
import { WorkshopError } from "@/lib/workshops/types";

/**
 * Cierra el asistente de primera configuración: datos del taller, equipo y
 * tarifas. Marca onboarding_completed = true (el panel deja de redirigir aquí).
 */
export async function completeOnboarding(data: unknown): Promise<ActionResult<null>> {
  const profile = await requireWorkshopAdmin();
  const parsed = onboardingSchema.safeParse(data);
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await getWorkshopRepository().completeOnboarding(profile.workshopId, parsed.data);
  } catch (error) {
    if (error instanceof WorkshopError) return failure(error.message);
    console.error("[onboarding action]", error);
    return failure("No se pudo guardar la configuración. Intenta de nuevo.");
  }

  // Nombre, tarifas e IVA se ven en todo el panel y en los comprobantes.
  revalidatePath("/", "layout");
  return success(null);
}
