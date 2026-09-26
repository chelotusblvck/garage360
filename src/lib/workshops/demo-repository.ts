import "server-only";
import type { WorkshopPayment } from "@/lib/billing/types";
import { WORKSHOP } from "@/lib/business";
import { DEMO_ACCOUNTS, DEMO_NEW_WORKSHOP_ID, findDemoAccount } from "@/lib/demo/accounts";
import { daysAgo, demoDb } from "@/lib/demo/db";
import { addDays, todayKey } from "@/lib/datetime";
import { demoQuotationStore } from "@/lib/quotations/demo-repository";
import { rutCheckDigit } from "@/lib/rut";
import { round2 } from "@/lib/sales/shared";
import { PLANS, SETUPS, hardwareLines } from "./plans";
import { DEFAULT_RECEPTION_POLICY, PRIMARY_WORKSHOP_ID, taxRateFromPercent } from "./shared";
import { WorkshopError, type Workshop, type WorkshopRepository, type WorkshopStaffMember } from "./types";

/* Talleres en memoria (modo demo). Mismas reglas que las funciones SQL de la sección 13. */

/** Invitación con enlace de activación (en SQL: columnas de workshop_staff). */
export type DemoStaffMember = WorkshopStaffMember & {
  activation_token_hash: string | null;
  activation_expires_at: string | null;
};

export type DemoWorkshopStore = {
  workshops: Workshop[];
  staff: DemoStaffMember[];
  payments: WorkshopPayment[];
  /** Cuentas de staff sin login demo propio (talleres de ejemplo del directorio). */
  extraUsers: Record<string, number>;
};

const rut = (body: string) => `${body}-${rutCheckDigit(body)}`;

function workshop(partial: Partial<Workshop> & Pick<Workshop, "id" | "name" | "created_at">): Workshop {
  return {
    rut: null,
    address: null,
    city: null,
    phone: null,
    email: null,
    specialty: null,
    logo_url: null,
    hourly_rate: 45_000,
    tax_rate: 0.19,
    reception_policy: null,
    plan: "starter",
    setup_type: "diy",
    setup_fee: 0,
    hardware: [],
    next_due_at: null,
    suspended_at: null,
    suspension_reason: null,
    onboarding_completed: false,
    onboarded_at: null,
    ...partial,
  };
}

const RIDER = "00000000-0000-0000-0000-000000000003";
const ENDURO = "00000000-0000-0000-0000-000000000004";
const SCOOTER = "00000000-0000-0000-0000-000000000005";

function seed(): DemoWorkshopStore {
  const today = todayKey();
  const payment = (workshop_id: string, p: Pick<WorkshopPayment, "concept" | "amount" | "method" | "paid_at" | "next_due_at"> & { notes?: string }) => ({
    id: crypto.randomUUID(),
    workshop_id,
    notes: null,
    created_by: "super@motoops.cl",
    created_at: `${p.paid_at}T15:00:00.000Z`,
    ...p,
  });

  return {
    workshops: [
      workshop({
        id: PRIMARY_WORKSHOP_ID,
        name: WORKSHOP.name,
        rut: rut("76543210"),
        address: "Av. Francisco Bilbao 2850",
        city: "Providencia",
        phone: WORKSHOP.phone,
        email: WORKSHOP.email,
        specialty: "Ducati y alta gama",
        reception_policy: DEFAULT_RECEPTION_POLICY,
        plan: "pro",
        setup_type: "turnkey",
        setup_fee: SETUPS.turnkey.fee,
        next_due_at: addDays(today, 12),
        onboarding_completed: true,
        onboarded_at: daysAgo(400, 11),
        created_at: daysAgo(400, 10),
      }),
      workshop({
        id: DEMO_NEW_WORKSHOP_ID,
        name: "Moto Sur Garage",
        email: "nuevo@motoops.cl",
        created_at: daysAgo(0, 9),
      }),
      workshop({
        id: RIDER,
        name: "Rider Pro Viña",
        rut: rut("77120455"),
        address: "Av. Libertad 1180",
        city: "Viña del Mar",
        phone: "+56 9 7712 0455",
        email: "contacto@riderpro.cl",
        specialty: "Multimarca",
        hourly_rate: 38_000,
        next_due_at: addDays(today, -3),
        onboarding_completed: true,
        onboarded_at: daysAgo(118, 12),
        created_at: daysAgo(120, 10),
      }),
      workshop({
        id: ENDURO,
        name: "Enduro Andes Taller",
        rut: rut("76980312"),
        address: "Esmeralda 455",
        city: "Los Andes",
        phone: "+56 9 6698 0312",
        email: "taller@enduroandes.cl",
        specialty: "Off-road y enduro",
        plan: "pro",
        hourly_rate: 35_000,
        next_due_at: addDays(today, -21),
        onboarding_completed: true,
        onboarded_at: daysAgo(58, 16),
        created_at: daysAgo(60, 15),
      }),
      workshop({
        id: SCOOTER,
        name: "Scooter Center Ñuñoa",
        plan: "enterprise",
        setup_type: "turnkey",
        setup_fee: SETUPS.turnkey.fee,
        email: "hola@scootercenter.cl",
        created_at: daysAgo(5, 18),
      }),
    ],
    staff: [],
    payments: [
      payment(PRIMARY_WORKSHOP_ID, { concept: "setup", amount: SETUPS.turnkey.fee, method: "transfer", paid_at: addDays(today, -400), next_due_at: null, notes: "Carga masiva + capacitación" }),
      payment(PRIMARY_WORKSHOP_ID, { concept: "annual", amount: PLANS.pro.monthly * 12, method: "transfer", paid_at: addDays(today, -353), next_due_at: addDays(today, 12) }),
      payment(RIDER, { concept: "monthly", amount: PLANS.starter.monthly, method: "webpay", paid_at: addDays(today, -33), next_due_at: addDays(today, -3) }),
      payment(ENDURO, { concept: "monthly", amount: PLANS.pro.monthly, method: "card", paid_at: addDays(today, -51), next_due_at: addDays(today, -21) }),
    ].sort((a, b) => b.paid_at.localeCompare(a.paid_at)),
    extraUsers: { [RIDER]: 4, [ENDURO]: 2, [SCOOTER]: 1 },
  };
}

const store = globalThis as typeof globalThis & { __motoopsDemoWorkshops?: DemoWorkshopStore };
export const demoWorkshopStore = () => (store.__motoopsDemoWorkshops ??= seed());

/** Cuentas de staff del taller: logins demo + (en el principal) los mecánicos sembrados. */
function userCount(s: DemoWorkshopStore, id: string) {
  const logins = DEMO_ACCOUNTS.filter((a) => a.workshopId === id).length;
  const mechanics = id === PRIMARY_WORKSHOP_ID ? demoDb().mechanics.length : 0;
  const linked = s.staff.filter((m) => m.workshop_id === id && m.profile_id).length;
  return logins + mechanics + linked + (s.extraUsers[id] ?? 0);
}

/** Invitación de admin pendiente de activar (la más reciente). */
export function pendingAdminInvite(s: DemoWorkshopStore, workshopId: string) {
  return s.staff.filter((m) => m.workshop_id === workshopId && m.role === "admin" && !m.profile_id).at(-1) ?? null;
}

export const demoWorkshopRepository: WorkshopRepository = {
  async get(id) {
    const w = demoWorkshopStore().workshops.find((x) => x.id === id);
    return w ? { ...w } : null;
  },

  async completeOnboarding(id, { profile, staff, settings }) {
    const s = demoWorkshopStore();
    const w = s.workshops.find((x) => x.id === id);
    if (!w) throw new WorkshopError("Taller no encontrado");

    const now = new Date().toISOString();
    Object.assign(w, {
      ...profile,
      hourly_rate: settings.hourly_rate,
      tax_rate: taxRateFromPercent(settings.tax_percent),
      reception_policy: settings.reception_policy,
      onboarding_completed: true,
      onboarded_at: now,
    });

    // En demo no hay registro de cuentas: el equipo queda activo de inmediato
    // y los mecánicos aparecen para asignarlos en las OTs.
    const db = demoDb();
    for (const member of staff) {
      const profileId = crypto.randomUUID();
      s.staff.push({
        id: crypto.randomUUID(),
        workshop_id: id,
        ...member,
        profile_id: profileId,
        activation_token_hash: null,
        activation_expires_at: null,
        created_at: now,
      });
      db.mechanics.push({ id: profileId, name: member.name });
    }
    return { ...w };
  },

  async create(input, setupFee, activation, quotationId) {
    const s = demoWorkshopStore();
    const email = input.admin_email;
    const account = findDemoAccount(email);
    const taken = (account && account.role !== "client") || s.staff.some((m) => m.email === email);
    if (taken) throw new WorkshopError("Ese email ya es staff de un taller", "admin_email");
    const quotation = quotationId ? demoQuotationStore().find((q) => q.id === quotationId) : null;
    if (quotationId && quotation?.status !== "pending") throw new WorkshopError("La cotización ya fue procesada o no existe");

    const now = new Date().toISOString();
    const created = workshop({
      id: crypto.randomUUID(),
      name: input.name,
      city: input.city,
      phone: input.phone,
      email,
      plan: input.plan,
      setup_type: input.setup_type,
      setup_fee: setupFee,
      hardware: hardwareLines(input.hardware),
      created_at: now,
    });
    s.workshops.push(created);
    s.staff.push({
      id: crypto.randomUUID(),
      workshop_id: created.id,
      name: input.admin_name,
      email,
      phone: null,
      role: "admin",
      specialty: null,
      profile_id: null,
      activation_token_hash: activation.tokenHash,
      activation_expires_at: activation.expiresAt,
      created_at: now,
    });
    if (quotation) Object.assign(quotation, { status: "approved", workshop_id: created.id, reviewed_at: now });
    return { ...created };
  },

  async lookupActivation(tokenHash) {
    const s = demoWorkshopStore();
    const invite = s.staff.find(
      (m) =>
        m.activation_token_hash === tokenHash &&
        !m.profile_id &&
        (!m.activation_expires_at || m.activation_expires_at > new Date().toISOString())
    );
    const w = invite ? s.workshops.find((x) => x.id === invite.workshop_id) : null;
    return invite && w && invite.email ? { workshopId: w.id, workshopName: w.name, name: invite.name, email: invite.email } : null;
  },

  async list() {
    const s = demoWorkshopStore();
    return s.workshops
      .map((w) => ({
        id: w.id,
        name: w.name,
        rut: w.rut,
        city: w.city,
        phone: w.phone,
        email: w.email,
        specialty: w.specialty,
        logo_url: w.logo_url,
        onboarding_completed: w.onboarding_completed,
        created_at: w.created_at,
        plan: w.plan,
        setup_type: w.setup_type,
        setup_fee: w.setup_fee,
        next_due_at: w.next_due_at,
        suspended_at: w.suspended_at,
        pending_invite: pendingAdminInvite(s, w.id)?.email ?? null,
        users: userCount(s, w.id),
        staff: s.staff.filter((m) => m.workshop_id === w.id).length,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async globalMetrics() {
    const s = demoWorkshopStore();
    const db = demoDb();
    const paid = db.sales.filter((x) => x.status === "paid");
    return {
      workshops: s.workshops.length,
      onboarded: s.workshops.filter((w) => w.onboarding_completed).length,
      staffUsers: s.workshops.reduce((sum, w) => sum + userCount(s, w.id), 0),
      workOrders: db.workOrders.length,
      openWorkOrders: db.workOrders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length,
      salesTotal: round2(paid.reduce((sum, x) => sum + x.subtotal + x.tax, 0)),
      salesCount: paid.length,
    };
  },
};
