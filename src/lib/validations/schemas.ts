import { z } from "zod";
import { isValidRut, normalizeRut } from "@/lib/rut";

/*
 * Esquemas Zod alineados 1:1 con supabase/schema.sql.
 * Si cambias un enum o constraint en SQL, actualízalo aquí también.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRoleSchema = z.enum(["admin", "mechanic", "client"]);
export const serviceTypeSchema = z.enum(["maintenance", "inspection", "repair"]);
export const appointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);
export const workOrderStatusSchema = z.enum([
  "open",
  "in_progress",
  "waiting_parts",
  "completed",
  "delivered",
  "cancelled",
]);
export const saleChannelSchema = z.enum(["online", "pos", "work_order"]);
export const saleStatusSchema = z.enum(["pending", "paid", "cancelled", "refunded"]);
export const paymentMethodSchema = z.enum([
  "cash",
  "card",
  "debit_card",
  "credit_card",
  "transfer",
  "online",
]);

// ---------------------------------------------------------------------------
// Primitivas reutilizables
// ---------------------------------------------------------------------------
const nonNegativeInt = z.coerce
  .number({ error: "Debe ser un número" })
  .int("Debe ser un número entero")
  .nonnegative("No puede ser negativo");

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{6,20}$/, "Teléfono inválido");

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.email("Email inválido").trim().toLowerCase(),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Ingresa tu nombre"),
    email: z.email("Email inválido").trim().toLowerCase(),
    phone: phone.optional().or(z.literal("").transform(() => undefined)),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

// ---------------------------------------------------------------------------
// Entidades (payloads de creación/edición)
// ---------------------------------------------------------------------------
export const profileSchema = z.object({
  name: z.string().trim().min(2),
  phone: phone.nullable(),
});

export const motorcycleSchema = z.object({
  client_id: z.uuid(),
  brand: z.string().trim().min(1, "Marca requerida"),
  model: z.string().trim().min(1, "Modelo requerido"),
  year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1, "Año inválido"),
  plate: z.string().trim().toUpperCase().min(4, "Patente inválida").max(12),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN inválido (17 caracteres, sin I/O/Q)")
    .nullable()
    .optional(),
  current_km: nonNegativeInt.default(0),
});

// Sin coerce: el formulario (React Hook Form) ya envía números, así el tipo
// de entrada es el mismo en cliente y servidor.
const formMoney = z
  .number({ error: "Ingresa un importe" })
  .nonnegative("No puede ser negativo")
  .max(99_999_999, "Importe demasiado alto")
  .multipleOf(0.01, "Máximo 2 decimales");

const formInt = z
  .number({ error: "Ingresa una cantidad" })
  .int("Debe ser un número entero")
  .nonnegative("No puede ser negativo")
  .max(1_000_000, "Cantidad demasiado alta");

export const productSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "SKU requerido")
    .max(40)
    .regex(/^[A-Z0-9][A-Z0-9\-_.]*$/, "Solo letras, números, guiones y puntos"),
  category: z.string().trim().min(1, "Elige una categoría").max(60),
  description: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .nullish()
    .transform((v) => v || null),
  cost: formMoney.nullable(),
  price: formMoney,
  stock: formInt,
  min_stock: formInt,
  image_url: z
    .url({ protocol: /^(https?|data)$/, error: "URL de imagen inválida" })
    .nullish()
    .transform((v) => v ?? null),
  is_active: z.boolean().default(true),
});

export const stockStatusFilterSchema = z.enum(["all", "low", "out"]);

export const productFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().trim().max(60).optional().catch(undefined),
  status: stockStatusFilterSchema.catch("all").default("all"),
});

export const stockMovementTypeSchema = z.enum(["in", "out"]);
export const manualStockReasonSchema = z.enum(["purchase", "return", "adjustment", "damage"]);

/** Motivos válidos por dirección del movimiento. */
export const REASONS_BY_TYPE = {
  in: ["purchase", "return", "adjustment"],
  out: ["damage", "adjustment"],
} as const satisfies Record<
  z.infer<typeof stockMovementTypeSchema>,
  readonly z.infer<typeof manualStockReasonSchema>[]
>;

export const stockAdjustmentSchema = z
  .object({
    quantity: z
      .number({ error: "Ingresa una cantidad" })
      .int("Debe ser un número entero")
      .positive("Mínimo 1 unidad")
      .max(100_000, "Cantidad demasiado alta"),
    type: stockMovementTypeSchema,
    reason: manualStockReasonSchema,
    note: z
      .string()
      .trim()
      .max(200, "Máximo 200 caracteres")
      .nullish()
      .transform((v) => v || null),
  })
  .refine(
    (d) => (REASONS_BY_TYPE[d.type] as readonly string[]).includes(d.reason),
    { message: "Motivo no válido para este tipo de movimiento", path: ["reason"] }
  );

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;


// ---------------------------------------------------------------------------
// Órdenes de trabajo
// ---------------------------------------------------------------------------
export const workOrderFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["all", ...workOrderStatusSchema.options]).catch("all").default("all"),
  view: z.enum(["board", "table"]).catch("board").default("board"),
});

const PHONE_REGEX = /^\+?[0-9\s\-()]{6,20}$/;
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;
/** Patentes chilenas de moto (AB123 / ABC12, se aceptan con "·" o "-") y similares: 5–8 alfanuméricos. */
const PLATE_REGEX = /^[A-Z0-9]{5,8}$/;

export const normalizePlate = (plate: string) => plate.toUpperCase().replace(/[\s\-.·]/g, "");

/** Campos de moto y cliente del alta de OT (ingreso espontáneo). */
const vehicleFields = {
  motorcycle_mode: z.enum(["existing", "new"]),
    motorcycle_id: z.uuid().nullish(),
    plate: z.string().trim().max(12).transform(normalizePlate),
    brand: z.string().trim().max(40),
    model: z.string().trim().max(60),
    year: z.number({ error: "Año inválido" }).int("Año inválido").nullable(),
    vin: z
      .string()
      .trim()
      .toUpperCase()
      .max(17)
      .nullish()
      .transform((v) => v || null),
    customer_mode: z.enum(["existing", "new"]),
    customer_id: z.uuid().nullish(),
    customer_name: z.string().trim().max(120),
    customer_phone: z.string().trim().max(20),
    customer_email: z.string().trim().toLowerCase().max(120),
};

type VehicleData = {
  motorcycle_mode: "existing" | "new";
  motorcycle_id?: string | null;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  vin: string | null;
  customer_mode: "existing" | "new";
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
};

/** Reglas condicionales: moto existente vs. nueva, cliente existente vs. nuevo. */
function refineVehicle(d: VehicleData, issue: (path: string, message: string) => void) {
  if (d.motorcycle_mode === "existing") {
    if (!d.motorcycle_id) issue("plate", "Busca y selecciona la moto");
    return;
  }

  if (!PLATE_REGEX.test(d.plate)) issue("plate", "Patente inválida (5 a 8 letras/números)");
  if (d.brand.length < 2) issue("brand", "Marca requerida");
  if (d.model.length < 1) issue("model", "Modelo requerido");
  const maxYear = new Date().getFullYear() + 1;
  if (d.year === null || Number.isNaN(d.year) || d.year < 1950 || d.year > maxYear) {
    issue("year", `Año entre 1950 y ${maxYear}`);
  }
  if (d.vin && !VIN_REGEX.test(d.vin)) issue("vin", "VIN inválido (17 caracteres, sin I/O/Q)");

  if (d.customer_mode === "existing") {
    if (!d.customer_id) issue("customer_id", "Selecciona un cliente");
  } else {
    if (d.customer_name.length < 2) issue("customer_name", "Nombre requerido");
    if (d.customer_phone && !PHONE_REGEX.test(d.customer_phone)) issue("customer_phone", "Teléfono inválido");
    if (d.customer_email && !z.email().safeParse(d.customer_email).success) {
      issue("customer_email", "Email inválido");
    }
  }
}

/** Identificación de la moto en la recepción (paso 1 del check-in, ingreso espontáneo). */
export const walkInVehicleSchema = z.object(vehicleFields).superRefine((d, ctx) => {
  refineVehicle(d, (path, message) => ctx.addIssue({ code: "custom", path: [path], message }));
});

/**
 * Alta de OT. Objeto plano con reglas condicionales: moto existente vs.
 * nueva, cliente existente vs. nuevo. Se usa dentro del check-in.
 */
export const createWorkOrderSchema = z
  .object({
    ...vehicleFields,
    mechanic_id: z.uuid().nullable(),
    intake_reason: z
      .string()
      .trim()
      .min(5, "Describe el motivo de ingreso (mín. 5 caracteres)")
      .max(1000, "Máximo 1000 caracteres"),
    // NaN (input vacío) se admite aquí y se valida en superRefine: si fallara
    // el tipo base, Zod omitiría el refinamiento y no se verían todos los errores.
    km: z.union([z.number(), z.nan()]),
  })
  .superRefine((d, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    if (Number.isNaN(d.km)) issue("km", "Ingresa el kilometraje");
    else if (!Number.isInteger(d.km) || d.km < 0) issue("km", "Kilometraje inválido");
    else if (d.km > 2_000_000) issue("km", "Kilometraje demasiado alto");

    refineVehicle(d, issue);
  });

export const workOrderDetailsSchema = z.object({
  diagnosis: z
    .string()
    .trim()
    .max(5000, "Máximo 5000 caracteres")
    .nullish()
    .transform((v) => v || null),
  mechanic_id: z.uuid().nullable(),
});

export const orderPartSchema = z.object({
  product_id: z.uuid("Selecciona un repuesto"),
  quantity: z
    .number({ error: "Ingresa una cantidad" })
    .int("Debe ser un número entero")
    .positive("Mínimo 1 unidad")
    .max(999, "Cantidad demasiado alta"),
  unit_price: formMoney.nullable(),
});

export const laborItemSchema = z.object({
  description: z.string().trim().min(2, "Describe el trabajo").max(200, "Máximo 200 caracteres"),
  hours: z
    .number({ error: "Ingresa las horas" })
    .positive("Debe ser mayor a 0")
    .max(200, "Máximo 200 h")
    .multipleOf(0.01, "Máximo 2 decimales"),
  hourly_rate: formMoney,
});

export const orderItemSchema = z.object({
  product_id: z.uuid(),
  quantity: z.coerce.number().int().positive("Cantidad mínima: 1"),
});

export const checkoutSchema = z.object({
  items: z.array(orderItemSchema).min(1, "El carrito está vacío"),
  shipping_address: z
    .object({
      street: z.string().trim().min(3),
      city: z.string().trim().min(2),
      postal_code: z.string().trim().min(3),
      notes: z.string().trim().max(300).optional(),
    })
    .nullable(),
});

// ---------------------------------------------------------------------------
// Ventas: punto de venta (mostrador) y tienda online
// ---------------------------------------------------------------------------
/** Línea de carrito: el precio nunca viaja desde el cliente (lo fija la base). */
export const cartItemSchema = z.object({
  product_id: z.uuid("Producto inválido"),
  quantity: z
    .number({ error: "Cantidad inválida" })
    .int("Debe ser un número entero")
    .positive("Mínimo 1 unidad")
    .max(999, "Cantidad demasiado alta"),
});

const cartSchema = (maxPerLine: number) =>
  z
    .array(cartItemSchema.refine((i) => i.quantity <= maxPerLine, `Máximo ${maxPerLine} unidades por producto`))
    .min(1, "El carrito está vacío")
    .max(50, "Máximo 50 productos distintos por venta");

export const posPaymentMethodSchema = z.enum(["cash", "debit_card", "credit_card", "transfer"]);

export const posSaleSchema = z.object({
  items: cartSchema(999),
  payment_method: posPaymentMethodSchema,
  customer_id: z.uuid().nullable().default(null),
  /** Suma IVA sobre los precios de lista (la tasa la fija el servidor). */
  apply_tax: z.boolean().default(false),
  /** Efectivo recibido, para calcular el vuelto. */
  amount_tendered: z
    .number({ error: "Importe inválido" })
    .nonnegative("No puede ser negativo")
    .max(999_999_999, "Importe demasiado alto")
    .nullable()
    .default(null),
  notes: z
    .string()
    .trim()
    .max(300, "Máximo 300 caracteres")
    .nullish()
    .transform((v) => v || null),
});

export const fulfillmentSchema = z.enum(["pickup", "delivery"]);
export const onlinePaymentMethodSchema = z.enum(["online", "transfer", "cash"]);

export const ecommerceCustomerSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(120, "Máximo 120 caracteres"),
  email: z.email("Email inválido").trim().toLowerCase().max(120),
  phone: z.string().trim().regex(PHONE_REGEX, "Teléfono inválido"),
  /** Honeypot anti-bots: debe llegar vacío. */
  website: z.string().max(0).optional(),
});

export const shippingDetailsSchema = z
  .object({
    fulfillment: fulfillmentSchema,
    street: z.string().trim().max(160),
    city: z.string().trim().max(80),
    postal_code: z.string().trim().max(12),
    notes: z
      .string()
      .trim()
      .max(300, "Máximo 300 caracteres")
      .nullish()
      .transform((v) => v || null),
  })
  .superRefine((d, ctx) => {
    if (d.fulfillment !== "delivery") return;
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (d.street.length < 3) issue("street", "Ingresa calle y número");
    if (d.city.length < 2) issue("city", "Ingresa la comuna");
    if (d.postal_code.length < 3) issue("postal_code", "Código postal inválido");
  });

/** Formulario de checkout completo (un solo objeto para React Hook Form). */
export const checkoutFormSchema = z
  .object({
    customer: ecommerceCustomerSchema,
    shipping: shippingDetailsSchema,
    payment_method: onlinePaymentMethodSchema,
  })
  .refine((d) => d.payment_method !== "cash" || d.shipping.fulfillment === "pickup", {
    message: "El pago en efectivo es solo para retiro en taller",
    path: ["payment_method"],
  });

const historyDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const salesHistoryFiltersSchema = z
  .object({
    from: historyDate.optional().catch(undefined),
    to: historyDate.optional().catch(undefined),
    channel: z.enum(["all", "pos", "online"]).catch("all").default("all"),
    payment_method: z.enum(["all", ...paymentMethodSchema.options]).catch("all").default("all"),
    q: z.string().trim().max(60).optional().catch(undefined),
  })
  .transform((f) => (f.from && f.to && f.from > f.to ? { ...f, from: f.to, to: f.from } : f));

// ---------------------------------------------------------------------------
// Agenda de citas
// ---------------------------------------------------------------------------
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const dateKeySchema = z.string().regex(DATE_KEY_REGEX, "Fecha inválida");

export const appointmentViewSchema = z.enum(["week", "month", "list"]);

/** Parámetros de la vista /dashboard/appointments (vienen de la URL). */
export const appointmentPageFiltersSchema = z.object({
  view: appointmentViewSchema.catch("week").default("week"),
  date: dateKeySchema.optional().catch(undefined),
  status: z.enum(["all", ...appointmentStatusSchema.options]).catch("all").default("all"),
  service: z.enum(["all", ...serviceTypeSchema.options]).catch("all").default("all"),
});

/** Filtros de getAppointments: rango [from, to] inclusive en días locales. */
export const appointmentFiltersSchema = z
  .object({
    from: dateKeySchema,
    to: dateKeySchema,
    status: z.enum(["all", ...appointmentStatusSchema.options]).default("all"),
    service: z.enum(["all", ...serviceTypeSchema.options]).default("all"),
  })
  .refine((f) => f.from <= f.to, { message: "Rango inválido", path: ["to"] });

/**
 * Reserva de turno (pública o interna). Si `motorcycle_id` viene (solo
 * staff, moto encontrada por patente), no se piden datos de moto/cliente.
 */
export const bookingSchema = z
  .object({
    service_type: serviceTypeSchema,
    date: z.string().regex(DATE_KEY_REGEX, "Elige una fecha"),
    time: z.string().regex(TIME_KEY_REGEX, "Elige un horario"),
    notes: z
      .string()
      .trim()
      .max(1000, "Máximo 1000 caracteres")
      .nullish()
      .transform((v) => v || null),
    motorcycle_id: z.uuid().nullish(),
    plate: z.string().trim().max(12).transform(normalizePlate),
    brand: z.string().trim().max(40),
    model: z.string().trim().max(60),
    year: z.number({ error: "Año inválido" }).int("Año inválido").nullable(),
    customer_name: z.string().trim().max(120),
    customer_phone: z.string().trim().max(20),
    customer_email: z.string().trim().toLowerCase().max(120),
    /** Honeypot anti-bots: debe llegar vacío. */
    website: z.string().max(0).optional(),
  })
  .superRefine((d, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (d.motorcycle_id) return;

    if (!PLATE_REGEX.test(d.plate)) issue("plate", "Patente inválida (5 a 8 letras/números)");
    if (d.brand.length < 2) issue("brand", "Marca requerida");
    if (d.model.length < 1) issue("model", "Modelo requerido");
    const maxYear = new Date().getFullYear() + 1;
    if (d.year === null || Number.isNaN(d.year) || d.year < 1950 || d.year > maxYear) {
      issue("year", `Año entre 1950 y ${maxYear}`);
    }
    if (d.customer_name.length < 2) issue("customer_name", "Ingresa tu nombre");
    if (!PHONE_REGEX.test(d.customer_phone)) issue("customer_phone", "Teléfono inválido");
    if (d.customer_email && !z.email().safeParse(d.customer_email).success) {
      issue("customer_email", "Email inválido");
    }
  });

export const rescheduleSchema = z.object({
  date: z.string().regex(DATE_KEY_REGEX, "Elige una fecha"),
  time: z.string().regex(TIME_KEY_REGEX, "Elige un horario"),
});

export const convertAppointmentSchema = z.object({
  mechanic_id: z.uuid().nullable(),
  km: z
    .number({ error: "Kilometraje inválido" })
    .int("Debe ser un número entero")
    .nonnegative("No puede ser negativo")
    .max(2_000_000)
    .nullable(),
});

// ---------------------------------------------------------------------------
// Clientes, motos y evidencia fotográfica
// ---------------------------------------------------------------------------
/** Texto opcional de formulario: "" → null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => v || null);

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Ingresa nombre y apellido").max(120, "Máximo 120 caracteres"),
  rut: z
    .string()
    .trim()
    .max(14)
    .refine((v) => !v || isValidRut(v), "RUT inválido (revisa el dígito verificador)")
    .transform((v) => (v ? normalizeRut(v) : null)),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => !v || PHONE_REGEX.test(v), "Teléfono inválido")
    .transform((v) => v || null),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .refine((v) => !v || z.email().safeParse(v).success, "Email inválido")
    .transform((v) => v || null),
  address: optionalText(160),
  city: optionalText(60),
});

export const customerMotorcycleSchema = z.object({
  plate: z
    .string()
    .trim()
    .max(12)
    .transform(normalizePlate)
    .refine((v) => PLATE_REGEX.test(v), "Patente inválida (ej: AB·123 o JKL·12)"),
  brand: z.string().trim().min(1, "Marca requerida").max(40),
  model: z.string().trim().min(1, "Modelo requerido").max(60),
  year: z
    .number({ error: "Año inválido" })
    .int("Año inválido")
    .min(1950, "Año inválido")
    .max(new Date().getFullYear() + 1, "Año inválido"),
  color: optionalText(40),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => !v || VIN_REGEX.test(v), "VIN inválido (17 caracteres, sin I/O/Q)")
    .transform((v) => v || null),
  current_km: z
    .number({ error: "Kilometraje inválido" })
    .int("Debe ser un número entero")
    .nonnegative("No puede ser negativo")
    .max(2_000_000),
  notes: optionalText(500),
});

export const customerFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
});

/** Etapa de la evidencia fotográfica de una OT. */
export const photoStageSchema = z.enum(["reception", "in_progress", "delivery"]);
export const photoCaptionSchema = optionalText(140);

export const WORK_ORDER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const WORK_ORDER_PHOTO_TYPES = PRODUCT_IMAGE_TYPES;

// ---------------------------------------------------------------------------
// Recepción de motos (check-in): fotos obligatorias antes de crear la OT
// ---------------------------------------------------------------------------
export const fuelLevelSchema = z.enum(["reserve", "quarter", "half", "three_quarters", "full"]);

/** Tomas de la recepción: las tres primeras son obligatorias. */
export const checkInPhotoSlotSchema = z.enum(["dashboard", "left", "right", "damage"]);
export const CHECK_IN_REQUIRED_SLOTS = ["dashboard", "left", "right"] as const;
export const CHECK_IN_MAX_PHOTOS = 16;

export const checkInPhotoSchema = z.object({
  /** Foto ya subida al área temporal (o "sample:<toma>" en modo demo). */
  token: z.string().trim().min(1).max(200),
  slot: checkInPhotoSlotSchema,
  note: optionalText(140),
});

export const checkInSchema = z
  .object({
    source: z.enum(["appointment", "walk_in"]),
    appointment_id: z.uuid().nullable(),
    /** Ingreso espontáneo: se valida con walkInVehicleSchema en el servidor. */
    vehicle: z.unknown().nullable(),
    km: z
      .number({ error: "Ingresa el kilometraje" })
      .int("Debe ser un número entero")
      .nonnegative("No puede ser negativo")
      .max(2_000_000, "Kilometraje demasiado alto"),
    fuel_level: fuelLevelSchema,
    intake_reason: z
      .string()
      .trim()
      .min(5, "Describe el motivo de ingreso (mín. 5 caracteres)")
      .max(1000, "Máximo 1000 caracteres"),
    mechanic_id: z.uuid().nullable(),
    photos: z.array(checkInPhotoSchema).max(CHECK_IN_MAX_PHOTOS, `Máximo ${CHECK_IN_MAX_PHOTOS} fotos`),
  })
  .superRefine((d, ctx) => {
    if (d.source === "appointment" && !d.appointment_id) {
      ctx.addIssue({ code: "custom", path: ["appointment_id"], message: "Selecciona la cita" });
    }
    if (d.source === "walk_in" && !d.vehicle) {
      ctx.addIssue({ code: "custom", path: ["plate"], message: "Identifica la moto" });
    }
    const missing = CHECK_IN_REQUIRED_SLOTS.filter((slot) => !d.photos.some((p) => p.slot === slot));
    if (missing.length) {
      ctx.addIssue({ code: "custom", path: ["photos"], message: "Faltan fotos obligatorias de recepción" });
    }
  });

// ---------------------------------------------------------------------------
// Tipos inferidos
// ---------------------------------------------------------------------------
export type UserRole = z.infer<typeof userRoleSchema>;
export type ServiceType = z.infer<typeof serviceTypeSchema>;
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;
export type WorkOrderStatus = z.infer<typeof workOrderStatusSchema>;
export type SaleChannel = z.infer<typeof saleChannelSchema>;
export type SaleStatus = z.infer<typeof saleStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type MotorcycleInput = z.infer<typeof motorcycleSchema>;
export type ProductFormValues = z.input<typeof productSchema>;
export type ProductInput = z.output<typeof productSchema>;
export type ProductFilters = z.output<typeof productFiltersSchema>;
export type StockStatusFilter = z.infer<typeof stockStatusFilterSchema>;
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
export type ManualStockReason = z.infer<typeof manualStockReasonSchema>;
export type StockAdjustmentValues = z.input<typeof stockAdjustmentSchema>;
export type StockAdjustmentInput = z.output<typeof stockAdjustmentSchema>;
export type AppointmentView = z.infer<typeof appointmentViewSchema>;
export type AppointmentPageFilters = z.output<typeof appointmentPageFiltersSchema>;
export type AppointmentFilters = z.input<typeof appointmentFiltersSchema>;
export type BookingValues = z.input<typeof bookingSchema>;
export type BookingInput = z.output<typeof bookingSchema>;
export type ConvertAppointmentValues = z.input<typeof convertAppointmentSchema>;
export type WorkOrderFilters = z.output<typeof workOrderFiltersSchema>;
export type CreateWorkOrderValues = z.input<typeof createWorkOrderSchema>;
export type CreateWorkOrderInput = z.output<typeof createWorkOrderSchema>;
export type WorkOrderDetailsValues = z.input<typeof workOrderDetailsSchema>;
export type WorkOrderDetailsInput = z.output<typeof workOrderDetailsSchema>;
export type OrderPartValues = z.input<typeof orderPartSchema>;
export type OrderPartInput = z.output<typeof orderPartSchema>;
export type LaborItemValues = z.input<typeof laborItemSchema>;
export type LaborItemInput = z.output<typeof laborItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CartItemInput = z.infer<typeof cartItemSchema>;
export type PosPaymentMethod = z.infer<typeof posPaymentMethodSchema>;
export type PosSaleValues = z.input<typeof posSaleSchema>;
export type PosSaleInput = z.output<typeof posSaleSchema>;
export type Fulfillment = z.infer<typeof fulfillmentSchema>;
export type OnlinePaymentMethod = z.infer<typeof onlinePaymentMethodSchema>;
export type EcommerceCustomerInput = z.output<typeof ecommerceCustomerSchema>;
export type ShippingDetailsInput = z.output<typeof shippingDetailsSchema>;
export type CheckoutFormValues = z.input<typeof checkoutFormSchema>;
export type CheckoutFormInput = z.output<typeof checkoutFormSchema>;
export type SalesHistoryFilters = z.output<typeof salesHistoryFiltersSchema>;
export type CustomerValues = z.input<typeof customerSchema>;
export type CustomerInput = z.output<typeof customerSchema>;
export type CustomerMotorcycleValues = z.input<typeof customerMotorcycleSchema>;
export type CustomerMotorcycleInput = z.output<typeof customerMotorcycleSchema>;
export type PhotoStage = z.infer<typeof photoStageSchema>;
export type WalkInVehicleValues = z.input<typeof walkInVehicleSchema>;
export type WalkInVehicleInput = z.output<typeof walkInVehicleSchema>;
export type FuelLevel = z.infer<typeof fuelLevelSchema>;
export type CheckInPhotoSlot = z.infer<typeof checkInPhotoSlotSchema>;
export type CheckInInput = z.output<typeof checkInSchema>;
