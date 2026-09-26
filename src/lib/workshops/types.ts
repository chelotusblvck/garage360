import type { NewWorkshopInput, OnboardingInput, StaffRole } from "@/lib/validations/schemas";
import type { PlanKey, SetupType } from "./plans";

/** Taller (tenant): datos comerciales, tarifas y estado del onboarding. */
export type Workshop = {
  id: string;
  name: string;
  /** Normalizado: "76543210-3". */
  rut: string | null;
  address: string | null;
  /** Comuna. */
  city: string | null;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  /** Data URL del logo (comprimido en el navegador). */
  logo_url: string | null;
  /** Valor hora de mano de obra sugerido (CLP). */
  hourly_rate: number;
  /** Fracción: 0.19 = 19 %. */
  tax_rate: number;
  reception_policy: string | null;
  /** Plan de suscripción contratado. */
  plan: PlanKey;
  /** Modalidad de implementación: autogestión o llave en mano (VIP). */
  setup_type: SetupType;
  /** Fee de setup cobrado al alta (CLP, pago único). */
  setup_fee: number;
  /** Próximo vencimiento de la suscripción (dateKey); null = nunca pagó. */
  next_due_at: string | null;
  /** Suspensión manual por mora: bloquea el panel (salvo modo soporte). */
  suspended_at: string | null;
  suspension_reason: string | null;
  onboarding_completed: boolean;
  onboarded_at: string | null;
  created_at: string;
};

export type WorkshopStaffMember = {
  id: string;
  workshop_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: StaffRole;
  specialty: string | null;
  /** Cuenta vinculada (null = invitación pendiente de registro). */
  profile_id: string | null;
  created_at: string;
};

/** Fila del directorio de talleres (superadmin). */
export type WorkshopSummary = Pick<
  Workshop,
  "id" | "name" | "rut" | "city" | "phone" | "email" | "specialty" | "logo_url" | "onboarding_completed" | "created_at" | "plan" | "setup_type" | "setup_fee" | "next_due_at" | "suspended_at"
> & {
  /** Email del admin invitado que aún no activa su cuenta. */
  pending_invite: string | null;
  /** Cuentas de staff vinculadas al taller. */
  users: number;
  /** Personas registradas en el onboarding (con o sin cuenta). */
  staff: number;
};

/** Indicadores consolidados de la plataforma (superadmin). */
export type GlobalMetrics = {
  workshops: number;
  onboarded: number;
  staffUsers: number;
  workOrders: number;
  openWorkOrders: number;
  /** Ventas pagadas (mostrador, online y repuestos de OT). */
  salesTotal: number;
  salesCount: number;
};

export interface WorkshopRepository {
  get(id: string): Promise<Workshop | null>;
  /** Guarda el onboarding de forma atómica y marca onboarding_completed. */
  completeOnboarding(id: string, input: OnboardingInput): Promise<Workshop>;
  /**
   * Alta desde /admin: taller con onboarding pendiente + invitación a su admin.
   * Con `quotationId`, aprueba esa cotización (pendiente) en la misma operación.
   */
  create(input: NewWorkshopInput, setupFee: number, activation: ActivationTicket, quotationId?: string): Promise<Workshop>;
  /** Invitación vigente para el token (su hash), o null si no existe, venció o ya se usó. */
  lookupActivation(tokenHash: string): Promise<ActivationInvite | null>;
  list(): Promise<WorkshopSummary[]>;
  globalMetrics(): Promise<GlobalMetrics>;
}

/** Error de negocio con mensaje apto para el usuario. */
export class WorkshopError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "WorkshopError";
  }
}

/** Token de activación: solo se guarda su hash; el token en claro va en el enlace. */
export type ActivationTicket = { tokenHash: string; expiresAt: string };

export type ActivationInvite = { workshopId: string; workshopName: string; name: string; email: string };
