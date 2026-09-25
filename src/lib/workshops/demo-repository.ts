import "server-only";
import { WORKSHOP } from "@/lib/business";
import { DEMO_ACCOUNTS, DEMO_NEW_WORKSHOP_ID } from "@/lib/demo/accounts";
import { daysAgo, demoDb } from "@/lib/demo/db";
import { rutCheckDigit } from "@/lib/rut";
import { round2 } from "@/lib/sales/shared";
import { DEFAULT_RECEPTION_POLICY, PRIMARY_WORKSHOP_ID, taxRateFromPercent } from "./shared";
import { WorkshopError, type Workshop, type WorkshopRepository, type WorkshopStaffMember } from "./types";

/* Talleres en memoria (modo demo). Mismas reglas que complete_workshop_onboarding() en SQL. */

type DemoWorkshopStore = {
  workshops: Workshop[];
  staff: WorkshopStaffMember[];
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
    onboarding_completed: false,
    onboarded_at: null,
    ...partial,
  };
}

function seed(): DemoWorkshopStore {
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
        id: "00000000-0000-0000-0000-000000000003",
        name: "Rider Pro Viña",
        rut: rut("77120455"),
        address: "Av. Libertad 1180",
        city: "Viña del Mar",
        phone: "+56 9 7712 0455",
        email: "contacto@riderpro.cl",
        specialty: "Multimarca",
        hourly_rate: 38_000,
        onboarding_completed: true,
        onboarded_at: daysAgo(118, 12),
        created_at: daysAgo(120, 10),
      }),
      workshop({
        id: "00000000-0000-0000-0000-000000000004",
        name: "Enduro Andes Taller",
        rut: rut("76980312"),
        address: "Esmeralda 455",
        city: "Los Andes",
        phone: "+56 9 6698 0312",
        email: "taller@enduroandes.cl",
        specialty: "Off-road y enduro",
        hourly_rate: 35_000,
        onboarding_completed: true,
        onboarded_at: daysAgo(58, 16),
        created_at: daysAgo(60, 15),
      }),
      workshop({
        id: "00000000-0000-0000-0000-000000000005",
        name: "Scooter Center Ñuñoa",
        email: "hola@scootercenter.cl",
        created_at: daysAgo(5, 18),
      }),
    ],
    staff: [],
    extraUsers: {
      "00000000-0000-0000-0000-000000000003": 4,
      "00000000-0000-0000-0000-000000000004": 2,
      "00000000-0000-0000-0000-000000000005": 1,
    },
  };
}

const store = globalThis as typeof globalThis & { __motoopsDemoWorkshops?: DemoWorkshopStore };
const demoWorkshops = () => (store.__motoopsDemoWorkshops ??= seed());

/** Cuentas de staff del taller: logins demo + (en el principal) los mecánicos sembrados. */
function userCount(s: DemoWorkshopStore, id: string) {
  const logins = DEMO_ACCOUNTS.filter((a) => a.workshopId === id).length;
  const mechanics = id === PRIMARY_WORKSHOP_ID ? demoDb().mechanics.length : 0;
  const onboarded = s.staff.filter((m) => m.workshop_id === id && m.profile_id).length;
  return logins + mechanics + onboarded + (s.extraUsers[id] ?? 0);
}

export const demoWorkshopRepository: WorkshopRepository = {
  async get(id) {
    const w = demoWorkshops().workshops.find((x) => x.id === id);
    return w ? { ...w } : null;
  },

  async completeOnboarding(id, { profile, staff, settings }) {
    const s = demoWorkshops();
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
      s.staff.push({ id: crypto.randomUUID(), workshop_id: id, ...member, profile_id: profileId, created_at: now });
      db.mechanics.push({ id: profileId, name: member.name });
    }
    return { ...w };
  },

  async list() {
    const s = demoWorkshops();
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
        users: userCount(s, w.id),
        staff: s.staff.filter((m) => m.workshop_id === w.id).length,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async globalMetrics() {
    const s = demoWorkshops();
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
