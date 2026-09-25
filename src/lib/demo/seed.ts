import type { AppointmentStatus, PhotoStage, ServiceType, WorkOrderStatus } from "@/lib/validations/schemas";
import type { DemoShot } from "./photos";

/*
 * Datos de ejemplo del modo demo: taller de Santiago de Chile especializado en
 * Ducati (y Triumph / Yamaha de gama media-alta). Precios en CLP. Las patentes
 * se guardan normalizadas (AB123 / JKL12) y se muestran como "AB·123".
 */

export type InventorySeed = {
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  /** Stock final tras todos los movimientos sembrados. */
  stock: number;
  min: number;
  /** Unidades vendidas en mostrador y online en los últimos meses (genera ventas e historial). */
  sold?: number;
  /** Unidades dadas de baja por daño (genera historial). */
  damaged?: number;
  description?: string;
};

export const INVENTORY_SEED: InventorySeed[] = [
  { name: "Pastillas Brembo sinterizadas delanteras (par)", sku: "BRK-BRB-F01", category: "Frenos", price: 69_900, cost: 42_000, stock: 0, min: 6, sold: 8, description: "Compuesto sinterizado para pinzas Brembo M4.32 / Stylema. Ducati Monster 937, Panigale V2, Multistrada V4 y Streetfighter V4." },
  { name: "Pastillas Brembo traseras", sku: "BRK-BRB-R01", category: "Frenos", price: 44_900, cost: 26_500, stock: 8, min: 6, sold: 5 },
  { name: "Disco de freno Brembo Serie Oro 320 mm", sku: "BRK-BRB-D320", category: "Frenos", price: 289_000, cost: 190_000, stock: 3, min: 2, sold: 1 },
  { name: "Líquido de frenos Motul RBF 600 500 ml", sku: "BRK-FLD-RBF600", category: "Frenos", price: 19_900, cost: 11_500, stock: 12, min: 6, sold: 6 },
  { name: "Aceite Shell Advance Ultra 15W-50 1 L", sku: "OIL-SHL-1550", category: "Lubricantes", price: 18_900, cost: 11_800, stock: 0, min: 24, sold: 30, description: "Lubricante oficial recomendado por Ducati. 100% sintético, JASO MA2, para motores Desmo Testastretta y Desmosedici Stradale." },
  { name: "Aceite Motul 7100 10W-40 1 L", sku: "OIL-MTL-1040", category: "Lubricantes", price: 16_900, cost: 10_500, stock: 27, min: 24, sold: 18, description: "100% sintético, JASO MA2. Ideal para Triumph y Yamaha de alto rendimiento." },
  { name: "Grasa para cadena Motul C2 400 ml", sku: "OIL-CHN-C2", category: "Lubricantes", price: 14_900, cost: 9_000, stock: 10, min: 8, sold: 4 },
  { name: "Filtro de aceite HiFlo HF153 (Ducati)", sku: "FLT-OIL-HF153", category: "Filtros", price: 12_900, cost: 7_000, stock: 19, min: 10, sold: 14 },
  { name: "Filtro de aceite HiFlo HF204 (Triumph / Yamaha)", sku: "FLT-OIL-HF204", category: "Filtros", price: 9_900, cost: 5_200, stock: 15, min: 8, sold: 10 },
  { name: "Filtro de aire K&N alto flujo Ducati Monster / Scrambler", sku: "FLT-AIR-KN-DUC", category: "Filtros", price: 94_900, cost: 62_000, stock: 3, min: 8, sold: 6, damaged: 1, description: "Lavable y reutilizable. Mayor flujo de aire que el filtro original." },
  { name: "Filtro de aire K&N Yamaha MT-07 / Ténéré 700", sku: "FLT-AIR-KN-YAM", category: "Filtros", price: 79_900, cost: 52_000, stock: 7, min: 5, sold: 3 },
  { name: "Correas de distribución Desmodrómicas Ducati 2V (par)", sku: "ENG-DSM-BELT2V", category: "Motor", price: 139_000, cost: 92_000, stock: 2, min: 4, sold: 4, description: "Par de correas originales para motores Desmo 2 válvulas (Scrambler 800/1100, Monster 797/821, Hypermotard 939)." },
  { name: "Kit de lainas Desmo (apertura y cierre)", sku: "ENG-DSM-SHIM", category: "Motor", price: 49_900, cost: 31_000, stock: 6, min: 4, sold: 2, description: "Surtido de lainas para el ajuste del juego de válvulas en el Desmo Service." },
  { name: "Juntas de tapa de válvulas Ducati (juego)", sku: "ENG-DSM-GSKT", category: "Motor", price: 34_900, cost: 21_500, stock: 5, min: 4, sold: 1 },
  { name: "Kit de arrastre DID 520 VX3 con retenes", sku: "DRV-DID-520", category: "Transmisión", price: 259_000, cost: 172_000, stock: 5, min: 3, sold: 2 },
  { name: "Kit de arrastre Ducati Performance 525 (Multistrada V4)", sku: "DRV-DP-525", category: "Transmisión", price: 389_000, cost: 262_000, stock: 2, min: 2, sold: 1 },
  { name: "Neumático Pirelli Diablo Rosso IV 120/70 ZR17", sku: "TIR-PIR-DR4-120", category: "Neumáticos", price: 219_000, cost: 152_000, stock: 4, min: 4, sold: 2 },
  { name: "Neumático Pirelli Diablo Supercorsa SP V3 200/55 ZR17", sku: "TIR-PIR-SC-200", category: "Neumáticos", price: 329_000, cost: 232_000, stock: 2, min: 2, sold: 1 },
  { name: "Neumático Pirelli Scorpion Rally STR 150/70 R18", sku: "TIR-PIR-STR-150", category: "Neumáticos", price: 189_000, cost: 128_000, stock: 4, min: 2, sold: 1 },
  { name: "Bujía NGK Iridium CR9EIX", sku: "IGN-NGK-CR9IX", category: "Encendido", price: 16_900, cost: 9_800, stock: 5, min: 12, sold: 15 },
  { name: "Batería Yuasa YTZ10S", sku: "ELE-BAT-YTZ10S", category: "Eléctrico", price: 129_000, cost: 88_000, stock: 5, min: 3, sold: 2 },
  { name: "Aceite de horquilla Motul Fork Oil 10W 1 L", sku: "SUS-OIL-10W", category: "Suspensión", price: 15_900, cost: 9_900, stock: 6, min: 4, sold: 2 },
  { name: "Guantes Alpinestars SP-8 v3 talla L", sku: "ACC-GLV-SP8", category: "Accesorios", price: 119_000, cost: 78_000, stock: 7, min: 3, sold: 3 },
];

type Seed = {
  status: WorkOrderStatus;
  daysAgo: number;
  /** Días desde el cierre (completada / entregada). */
  closedDaysAgo?: number;
  customer: { name: string; phone: string | null; email: string | null };
  moto: { brand: string; model: string; year: number; plate: string };
  mechanic: string | null;
  km: number;
  reason: string;
  diagnosis?: string;
  parts: { sku: string; qty: number }[];
  labor: { description: string; hours: number; rate?: number }[];
  /** Evidencia fotográfica de ejemplo (ilustraciones SVG, ver demo/photos.ts). */
  photos?: PhotoSeed[];
};

type PhotoSeed = { stage: PhotoStage; shot: DemoShot; caption: string; label?: string };

const sebastian = { name: "Sebastián Fuentes", phone: "+56 9 8123 4567", email: "sebastian.fuentes@mail.cl" };
const cristobal = { name: "Cristóbal Muñoz", phone: "+56 9 7654 3210", email: null };
const matias = { name: "Matías Contreras", phone: "+56 9 6612 7788", email: "mcontreras@mail.cl" };
const andres = { name: "Andrés Valenzuela", phone: "+56 9 8277 1904", email: "andres.valenzuela@mail.cl" };
const paula = { name: "Paula Sepúlveda", phone: "+56 9 5064 3321", email: "paula.sepulveda@mail.cl" };

const monster937 = { brand: "Ducati", model: "Monster 937", year: 2022, plate: "GH789" };
const scrambler1100 = { brand: "Ducati", model: "Scrambler 1100 Sport PRO", year: 2021, plate: "AB123" };
const multistrada = { brand: "Ducati", model: "Multistrada V4 S", year: 2022, plate: "JKL12" };
const panigaleV4 = { brand: "Ducati", model: "Panigale V4", year: 2022, plate: "PGH44" };
const streetTripleR = { brand: "Triumph", model: "Street Triple 765 R", year: 2023, plate: "TRP76" };

/** Número de folio de la primera OT sembrada (las demás son correlativas). */
export const WORK_ORDER_FIRST_NUMBER = 26;

export const WORK_ORDER_SEED: Seed[] = [
  // ---- Historial (hoja de vida): OTs entregadas en meses anteriores ----------
  {
    status: "delivered", daysAgo: 300, closedDaysAgo: 299,
    customer: cristobal,
    moto: monster937,
    mechanic: "Pedro Álvarez", km: 1_020,
    reason: "Mantención de rodaje (1.000 km).",
    diagnosis: "Cambio de aceite y filtro de rodaje. Tensión de cadena y torque de ejes verificados. Sin observaciones.",
    parts: [{ sku: "OIL-SHL-1550", qty: 3 }, { sku: "FLT-OIL-HF153", qty: 1 }],
    labor: [{ description: "Mantención de rodaje 1.000 km", hours: 1 }],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso: moto sin detalles de carrocería" },
      { stage: "reception", shot: "odometer", caption: "Kilometraje al ingreso" },
    ],
  },
  {
    status: "delivered", daysAgo: 180, closedDaysAgo: 177,
    customer: matias,
    moto: scrambler1100,
    mechanic: "Ramiro Sosa", km: 12_050,
    reason: "Desmo Service de 12.000 km (inspección de juego de válvulas).",
    diagnosis: "Juego de válvulas dentro de tolerancia. Se cambian juntas de tapa de válvulas por filtración leve.",
    parts: [{ sku: "OIL-SHL-1550", qty: 4 }, { sku: "FLT-OIL-HF153", qty: 1 }, { sku: "ENG-DSM-GSKT", qty: 1 }],
    labor: [{ description: "Desmo Service: inspección de juego de válvulas", hours: 2.5 }],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso al taller" },
      { stage: "in_progress", shot: "engine", caption: "Tapas de válvulas abiertas: medición de holguras" },
    ],
  },
  {
    status: "delivered", daysAgo: 130, closedDaysAgo: 127,
    customer: sebastian,
    moto: multistrada,
    mechanic: "Ramiro Sosa", km: 15_120,
    reason: "Mantención de 15.000 km.",
    diagnosis: "Mantención completa (aceite, filtros, revisión de suspensión Skyhook y frenos). Pastillas delanteras al 60 %.",
    parts: [{ sku: "OIL-SHL-1550", qty: 5 }, { sku: "FLT-OIL-HF153", qty: 1 }],
    labor: [{ description: "Mantención 15.000 km", hours: 2.5 }],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso: maletas laterales montadas" },
      { stage: "reception", shot: "odometer", caption: "Kilometraje al ingreso" },
      { stage: "delivery", shot: "side", caption: "Entrega: moto lavada y revisada" },
    ],
  },
  {
    status: "delivered", daysAgo: 70, closedDaysAgo: 66,
    customer: andres,
    moto: panigaleV4,
    mechanic: "Pedro Álvarez", km: 9_050,
    reason: "Mantención de 9.000 km + neumático trasero. Reporta rayón en carenado lateral izquierdo (caída en detenido).",
    diagnosis: "Mantención realizada e instalado Pirelli Supercorsa SP V3 trasero. El rayón del carenado queda registrado en la recepción; el cliente lo evaluará con su carrocero.",
    parts: [{ sku: "OIL-SHL-1550", qty: 4 }, { sku: "FLT-OIL-HF153", qty: 1 }, { sku: "TIR-PIR-SC-200", qty: 1 }],
    labor: [{ description: "Mantención 9.000 km", hours: 1.5 }, { description: "Cambio y balanceo de neumático trasero", hours: 0.75 }],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso: vista lateral" },
      { stage: "reception", shot: "damage", caption: "Rayón en carenado lateral izquierdo (preexistente)", label: "Rayón carenado" },
      { stage: "reception", shot: "odometer", caption: "Kilometraje al ingreso" },
      { stage: "in_progress", shot: "brake", caption: "Revisión de pinzas Brembo Stylema y discos" },
      { stage: "delivery", shot: "side", caption: "Entrega con neumático trasero nuevo" },
    ],
  },
  {
    status: "delivered", daysAgo: 48, closedDaysAgo: 46,
    customer: paula,
    moto: streetTripleR,
    mechanic: "Ana Torres", km: 8_010,
    reason: "Mantención de 8.000 km + tensado y lubricación de cadena.",
    diagnosis: "Mantención realizada. Cadena con holgura excesiva: se tensa y lubrica. Desgaste de corona dentro de lo normal.",
    parts: [{ sku: "OIL-MTL-1040", qty: 3 }, { sku: "FLT-OIL-HF204", qty: 1 }, { sku: "OIL-CHN-C2", qty: 1 }],
    labor: [{ description: "Mantención 8.000 km", hours: 1.25 }, { description: "Tensado y lubricación de cadena", hours: 0.25 }],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso: vista lateral" },
      { stage: "reception", shot: "odometer", caption: "Kilometraje al ingreso" },
      { stage: "in_progress", shot: "chain", caption: "Cadena y corona antes del tensado" },
      { stage: "delivery", shot: "side", caption: "Entrega" },
    ],
  },
  // ---- OTs recientes y en curso ---------------------------------------------
  {
    status: "delivered", daysAgo: 12, closedDaysAgo: 8,
    customer: cristobal,
    moto: monster937,
    mechanic: "Ramiro Sosa", km: 8_950,
    reason: "Freno trasero chilla y el pedal se siente esponjoso.",
    diagnosis: "Pastillas traseras al límite y líquido contaminado. Se reemplazan pastillas Brembo y se purga el circuito.",
    parts: [{ sku: "BRK-BRB-R01", qty: 1 }, { sku: "BRK-FLD-RBF600", qty: 1 }],
    labor: [{ description: "Cambio de pastillas traseras", hours: 0.5 }, { description: "Purgado de circuito de frenos", hours: 0.5 }],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso: vista lateral" },
      { stage: "in_progress", shot: "brake", caption: "Pastillas traseras nuevas instaladas" },
      { stage: "delivery", shot: "side", caption: "Entrega al cliente" },
    ],
  },
  {
    status: "delivered", daysAgo: 5, closedDaysAgo: 3,
    customer: { name: "Francisca Rojas", phone: "+56 9 9345 1122", email: "fran.rojas@mail.cl" },
    moto: { brand: "Triumph", model: "Street Triple 765 RS", year: 2021, plate: "BC456" },
    mechanic: "Pedro Álvarez", km: 21_300,
    reason: "No arranca por las mañanas, batería descargada.",
    diagnosis: "Batería sulfatada (11,9 V en reposo). Sistema de carga OK. Se reemplaza batería.",
    parts: [{ sku: "ELE-BAT-YTZ10S", qty: 1 }],
    labor: [{ description: "Diagnóstico eléctrico y cambio de batería", hours: 0.75 }],
  },
  {
    status: "completed", daysAgo: 3, closedDaysAgo: 0,
    customer: matias,
    moto: scrambler1100,
    mechanic: "Pedro Álvarez", km: 24_040,
    reason: "Desmo Service de 24.000 km.",
    diagnosis: "Desmo Service completo: juego de válvulas fuera de tolerancia en 2 cierres (ajustado con lainas), correas de distribución reemplazadas. Se recomienda cambio de neumático trasero en la próxima mantención (desgaste 70 %).",
    parts: [
      { sku: "OIL-SHL-1550", qty: 4 },
      { sku: "FLT-OIL-HF153", qty: 1 },
      { sku: "ENG-DSM-BELT2V", qty: 1 },
      { sku: "ENG-DSM-SHIM", qty: 1 },
      { sku: "ENG-DSM-GSKT", qty: 1 },
    ],
    labor: [
      { description: "Desmo Service: inspección y ajuste de juego de válvulas", hours: 3.5 },
      { description: "Cambio de correas de distribución", hours: 1.5 },
      { description: "Cambio de aceite y filtro", hours: 0.5 },
    ],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso: vista lateral" },
      { stage: "reception", shot: "odometer", caption: "Kilometraje al ingreso" },
      { stage: "in_progress", shot: "engine", caption: "Juego de válvulas: 2 cierres fuera de tolerancia" },
      { stage: "delivery", shot: "side", caption: "Lista para entrega" },
    ],
  },
  {
    status: "in_progress", daysAgo: 2,
    customer: sebastian,
    moto: multistrada,
    mechanic: "Ramiro Sosa", km: 29_870,
    reason: "Mantención de 30.000 km + ruido metálico en la transmisión al acelerar.",
    diagnosis: "Cadena estirada fuera de tolerancia y piñón con desgaste. Se reemplaza kit de arrastre Ducati Performance.",
    parts: [{ sku: "OIL-SHL-1550", qty: 5 }, { sku: "FLT-OIL-HF153", qty: 1 }, { sku: "DRV-DP-525", qty: 1 }],
    labor: [{ description: "Mantención 30.000 km", hours: 2 }, { description: "Cambio de kit de arrastre", hours: 1.5 }],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso: vista lateral" },
      { stage: "reception", shot: "odometer", caption: "Kilometraje al ingreso" },
      { stage: "in_progress", shot: "chain", caption: "Cadena estirada fuera de tolerancia" },
    ],
  },
  {
    status: "in_progress", daysAgo: 1,
    customer: { name: "Ignacio Pizarro", phone: "+56 9 5234 9901", email: "ignacio.pizarro@mail.cl" },
    moto: { brand: "Yamaha", model: "Ténéré 700", year: 2022, plate: "KLT45" },
    mechanic: "Ana Torres", km: 15_420,
    reason: "Preparación para viaje por la Carretera Austral: revisión general y neumático trasero.",
    parts: [{ sku: "TIR-PIR-STR-150", qty: 1 }],
    labor: [{ description: "Revisión general pre-viaje", hours: 1 }, { description: "Desmontaje, montaje y balanceo de neumático", hours: 0.75 }],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso: vista lateral" },
      { stage: "reception", shot: "damage", caption: "Rayón en estanque (preexistente, uso off-road)", label: "Rayón estanque" },
    ],
  },
  {
    status: "waiting_parts", daysAgo: 4,
    customer: { name: "Catalina Soto", phone: "+56 9 8876 2210", email: "cata.soto@mail.cl" },
    moto: { brand: "Ducati", model: "Panigale V2", year: 2021, plate: "DF321" },
    mechanic: "Pedro Álvarez", km: 9_310,
    reason: "Frenado débil adelante y vibración en el manubrio al frenar.",
    diagnosis: "Discos delanteros con alabeo (0,3 mm). Se pidió par de discos Brembo 320 mm al importador; llegan el jueves.",
    parts: [{ sku: "BRK-FLD-RBF600", qty: 1 }],
    labor: [{ description: "Diagnóstico de sistema de frenos", hours: 0.5 }],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso: vista lateral" },
      { stage: "in_progress", shot: "brake", caption: "Disco delantero con alabeo de 0,3 mm" },
    ],
  },
  {
    status: "waiting_parts", daysAgo: 6,
    customer: sebastian,
    moto: { brand: "Triumph", model: "Tiger 900 Rally Pro", year: 2022, plate: "RST18" },
    mechanic: "Ana Torres", km: 27_150,
    reason: "Testigo de ABS encendido de forma intermitente.",
    diagnosis: "Sensor ABS trasero con lectura errática. Repuesto original pedido a Triumph (demora 10 días).",
    parts: [],
    labor: [{ description: "Diagnóstico con escáner", hours: 1 }],
  },
  {
    status: "open", daysAgo: 0,
    customer: { name: "Javiera Morales", phone: "+56 9 7390 4455", email: "javiera.morales@mail.cl" },
    moto: { brand: "Ducati", model: "Scrambler 800 Icon", year: 2020, plate: "HJ654" },
    mechanic: null, km: 12_200,
    reason: "Desmo Service de 12.000 km (inspección de juego de válvulas). Tironea en frío.",
    parts: [],
    labor: [],
  },
  {
    status: "open", daysAgo: 0,
    customer: { name: "Antonia Vargas", phone: "+56 9 6120 3344", email: "antonia.vargas@mail.cl" },
    moto: { brand: "Triumph", model: "Trident 660", year: 2023, plate: "PTZ27" },
    mechanic: "Ramiro Sosa", km: 10_020,
    reason: "Mantención de 10.000 km.",
    parts: [],
    labor: [],
    photos: [
      { stage: "reception", shot: "side", caption: "Ingreso: vista lateral" },
      { stage: "reception", shot: "odometer", caption: "Kilometraje al ingreso" },
    ],
  },
  {
    status: "cancelled", daysAgo: 9, closedDaysAgo: 8,
    customer: { name: "Felipe Araya", phone: "+56 9 9011 7766", email: null },
    moto: { brand: "Ducati", model: "Hypermotard 950", year: 2019, plate: "CD987" },
    mechanic: null, km: 31_800,
    reason: "Presupuesto de Desmo Service mayor + cambio de embrague.",
    diagnosis: "El cliente no aprobó el presupuesto y retiró la moto.",
    parts: [],
    labor: [],
  },
];

type AppointmentSeed = {
  /** Días desde hoy (si cae domingo, se mueve al lunes). */
  day: number;
  time: string;
  service: ServiceType;
  status: AppointmentStatus;
  customer: { name: string; phone: string; email: string | null };
  moto: { brand: string; model: string; year: number; plate: string };
  km?: number;
  notes?: string;
  source?: "staff" | "public";
  /** Número de OT sembrada que se originó en esta cita. */
  convertedTo?: number;
};

export const APPOINTMENT_SEED: AppointmentSeed[] = [
  // Días anteriores
  {
    day: -2, time: "15:00", service: "maintenance", status: "no_show",
    customer: { name: "Rodrigo Tapia", phone: "+56 9 5402 1180", email: "rodrigo.tapia@mail.cl" },
    moto: { brand: "Yamaha", model: "YZF-R6", year: 2018, plate: "FG246" }, km: 18_200,
    notes: "Mantención 18.000 km. No respondió los recordatorios.",
  },
  {
    day: -1, time: "09:00", service: "inspection", status: "completed", convertedTo: 35,
    customer: { name: "Ignacio Pizarro", phone: "+56 9 5234 9901", email: "ignacio.pizarro@mail.cl" },
    moto: { brand: "Yamaha", model: "Ténéré 700", year: 2022, plate: "KLT45" },
    notes: "Revisión completa antes de viajar por la Carretera Austral.", source: "public",
  },
  {
    day: -1, time: "11:00", service: "repair", status: "cancelled",
    customer: { name: "Constanza Reyes", phone: "+56 9 8130 5566", email: "coni.reyes@mail.cl" },
    moto: { brand: "Ducati", model: "Monster 821", year: 2019, plate: "GK135" },
    notes: "Falla de arranque. Canceló: consiguió el repuesto por su cuenta.", source: "public",
  },
  // Hoy
  {
    day: 0, time: "09:00", service: "maintenance", status: "completed", convertedTo: 39,
    customer: { name: "Antonia Vargas", phone: "+56 9 6120 3344", email: "antonia.vargas@mail.cl" },
    moto: { brand: "Triumph", model: "Trident 660", year: 2023, plate: "PTZ27" },
    notes: "Mantención de 10.000 km.",
  },
  {
    day: 0, time: "10:30", service: "inspection", status: "confirmed",
    customer: { name: "Martina Espinoza", phone: "+56 9 7315 0098", email: "martina.espinoza@mail.cl" },
    moto: { brand: "Yamaha", model: "MT-07", year: 2021, plate: "JB310" }, km: 22_400,
    notes: "Revisión general antes de la revisión técnica.", source: "public",
  },
  {
    day: 0, time: "11:00", service: "maintenance", status: "confirmed",
    customer: { name: "Benjamín Castillo", phone: "+56 9 6412 8870", email: "bcastillo@mail.cl" },
    moto: { brand: "Triumph", model: "Speed Twin 1200", year: 2022, plate: "LM522" }, km: 16_100,
    notes: "Mantención 16.000 km + cambio de pastillas si corresponde.",
  },
  {
    day: 0, time: "14:00", service: "repair", status: "scheduled",
    customer: { name: "Vicente Navarro", phone: "+56 9 7781 2093", email: null },
    moto: { brand: "Ducati", model: "Streetfighter V4", year: 2021, plate: "SFV40" }, km: 14_300,
    notes: "Pierde refrigerante por la bomba de agua.", source: "public",
  },
  {
    day: 0, time: "15:30", service: "maintenance", status: "scheduled",
    customer: { name: "Francisca Rojas", phone: "+56 9 9345 1122", email: "fran.rojas@mail.cl" },
    moto: { brand: "Triumph", model: "Street Triple 765 RS", year: 2021, plate: "BC456" },
    notes: "Mantención 25.000 km.", source: "public",
  },
  // Próximos días
  {
    day: 1, time: "09:00", service: "maintenance", status: "confirmed",
    customer: cristobal,
    moto: monster937,
    notes: "Mantención 15.000 km (aceite Shell Advance y filtro).",
  },
  {
    day: 1, time: "11:00", service: "inspection", status: "scheduled",
    customer: { name: "Tomás Gutiérrez", phone: "+56 9 9921 4410", email: "tomas.gutierrez@mail.cl" },
    moto: { brand: "Yamaha", model: "YZF-R1", year: 2020, plate: "RYZ10" }, km: 12_800,
    notes: "Quiere revisar la moto antes de venderla.", source: "public",
  },
  {
    day: 2, time: "10:00", service: "repair", status: "scheduled",
    customer: paula,
    moto: streetTripleR, km: 9_700,
    notes: "Ruido metálico en la rueda trasera al frenar.", source: "public",
  },
  {
    day: 2, time: "14:30", service: "maintenance", status: "confirmed",
    customer: andres,
    moto: panigaleV4, km: 12_050,
    notes: "Mantención 12.000 km + neumático trasero Supercorsa.",
  },
  {
    day: 3, time: "09:30", service: "maintenance", status: "scheduled",
    customer: sebastian,
    moto: { brand: "Triumph", model: "Tiger 900 Rally Pro", year: 2022, plate: "RST18" },
    notes: "Mantención 30.000 km (coordinar con la llegada del sensor ABS).",
  },
  {
    day: 4, time: "12:00", service: "inspection", status: "scheduled",
    customer: { name: "Macarena Silva", phone: "+56 9 8845 6012", email: "macarena.silva@mail.cl" },
    moto: { brand: "Yamaha", model: "MT-09", year: 2023, plate: "DTK09" }, km: 16_900,
    source: "public",
  },
];

/** Ficha de cada cliente del taller (RUT, domicilio y comuna de Santiago). */
export const CUSTOMER_PROFILES: Record<string, { rut: string; address: string; city: string }> = {
  "Cristóbal Muñoz": { rut: "15834221-9", address: "Av. Pedro de Valdivia 1850, depto. 504", city: "Providencia" },
  "Francisca Rojas": { rut: "17290456-4", address: "Camino La Dehesa 1500", city: "Lo Barnechea" },
  "Matías Contreras": { rut: "18455102-0", address: "Av. Providencia 1650, of. 302", city: "Providencia" },
  "Sebastián Fuentes": { rut: "12987334-5", address: "Av. Apoquindo 5400, depto. 1101", city: "Las Condes" },
  "Ignacio Pizarro": { rut: "16700458-K", address: "Av. Grecia 8735", city: "Peñalolén" },
  "Catalina Soto": { rut: "19233871-9", address: "Av. Vitacura 8900", city: "Vitacura" },
  "Javiera Morales": { rut: "20114567-8", address: "Av. Irarrázaval 2940, depto. 803", city: "Ñuñoa" },
  "Antonia Vargas": { rut: "17888902-8", address: "Av. Irarrázaval 3450, depto. 1204", city: "Ñuñoa" },
  "Felipe Araya": { rut: "13456120-3", address: "San Antonio 385, of. 1204", city: "Santiago Centro" },
  "Rodrigo Tapia": { rut: "14320987-3", address: "Lord Cochrane 120", city: "Santiago Centro" },
  "Constanza Reyes": { rut: "18990345-6", address: "Av. José Arrieta 7500", city: "Peñalolén" },
  "Martina Espinoza": { rut: "19876543-0", address: "Av. Manuel Montt 1234", city: "Providencia" },
  "Benjamín Castillo": { rut: "16234789-6", address: "Av. Presidente Kennedy 9001", city: "Las Condes" },
  "Vicente Navarro": { rut: "20567891-3", address: "Camino Los Trapenses 3300", city: "Lo Barnechea" },
  "Tomás Gutiérrez": { rut: "15098234-0", address: "Av. Ossa 1990", city: "Ñuñoa" },
  "Paula Sepúlveda": { rut: "17654320-5", address: "Av. Nueva Costanera 3900", city: "Vitacura" },
  "Andrés Valenzuela": { rut: "12345987-3", address: "Av. Alonso de Córdova 2600", city: "Vitacura" },
  "Macarena Silva": { rut: "18123456-3", address: "Av. Santa Rosa 150", city: "Santiago Centro" },
};

/** Color y observaciones de cada moto, por patente. */
export const MOTO_DETAILS: Record<string, { color: string; notes?: string }> = {
  GH789: { color: "Rojo Ducati", notes: "Escape Termignoni homologado. Cliente pide siempre Shell Advance Ultra." },
  BC456: { color: "Gris Titanio" },
  AB123: { color: "Negro Mate", notes: "Desmo Service cada 12.000 km. Correas cambiadas a los 24.000 km." },
  JKL12: { color: "Gris Aviator", notes: "Maletas laterales Ducati Performance. Revisar calibración Skyhook en cada mantención." },
  KLT45: { color: "Azul Yamaha", notes: "Protector de cárter y defensas SW-Motech. Uso off-road frecuente." },
  DF321: { color: "Rojo Ducati" },
  RST18: { color: "Blanco Snowdonia" },
  HJ654: { color: "Amarillo Ducati" },
  PTZ27: { color: "Blanco Cristal" },
  CD987: { color: "Rojo Ducati" },
  FG246: { color: "Azul Yamaha" },
  GK135: { color: "Negro" },
  JB310: { color: "Gris Storm" },
  LM522: { color: "Verde Competition" },
  SFV40: { color: "Rojo Ducati", notes: "Uso en pista (track days). Neumáticos Supercorsa." },
  RYZ10: { color: "Azul Icon" },
  TRP76: { color: "Negro Mate", notes: "Cliente reporta uso diario en ciudad." },
  PGH44: { color: "Rojo Ducati", notes: "Rayón en carenado lateral izquierdo registrado en la recepción de la OT-0029." },
  DTK09: { color: "Gris Tech Kamo" },
};

/** Códigos postales de referencia para los despachos de la tienda online. */
export const COMUNA_POSTAL_CODE: Record<string, string> = {
  Providencia: "7500000",
  "Las Condes": "7550000",
  Peñalolén: "7910000",
  Vitacura: "7630000",
  Ñuñoa: "7750000",
  "Lo Barnechea": "7690000",
  "Santiago Centro": "8320000",
};

/** Clientes del taller que además compran en la tienda online y el mostrador. */
export const SALES_SEED_BUYERS = [
  "Antonia Vargas",
  "Sebastián Fuentes",
  "Catalina Soto",
  "Ignacio Pizarro",
  "Francisca Rojas",
  "Matías Contreras",
  "Rodrigo Tapia",
  "Paula Sepúlveda",
  "Andrés Valenzuela",
];
