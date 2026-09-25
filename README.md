# MotoOps

Gestión integral para talleres de motocicletas: inventario, órdenes de trabajo, agenda de servicios y tienda online.

**Stack:** Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Recharts · Supabase (Auth, Postgres, Storage) · Zod

## Puesta en marcha

```bash
npm install
npm run dev          # http://localhost:3000
```

Sin variables de entorno la app corre en **modo demo**: el dashboard (`/dashboard`) es accesible con datos de ejemplo.

### Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. SQL Editor → pega y ejecuta `supabase/schema.sql`.
3. Copia `.env.example` a `.env.local` y completa URL + publishable key (Project Settings → API).
4. Regístrate en `/register` y promueve tu usuario a admin desde el SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'tu@email.com';
   ```

## Estructura

```
src/
├─ app/
│  ├─ (public)/        Tienda: home, /shop, /shop/checkout, /booking
│  ├─ (auth)/          /login, /register + server actions
│  └─ (dashboard)/     Layout con sidebar + /dashboard/{metrics,pos,sales,inventory,appointments,orders}
├─ components/
│  ├─ ui/              Componentes shadcn
│  ├─ dashboard/       Sidebar, header, navegación
│  └─ brand/           Logo
├─ lib/
│  ├─ supabase/        Clientes browser / server / proxy
│  ├─ validations/     Esquemas Zod (espejo del SQL)
│  ├─ data/            Capa de datos (hoy dummy → Supabase)
│  ├─ auth.ts          Sesión y guardas de rol
│  └─ format.ts        Moneda / fechas (locale centralizado)
└─ proxy.ts            Refresco de sesión y redirecciones (ex-middleware)
supabase/schema.sql    Esquema, triggers de stock, RLS y Storage
```

## Módulo de inventario (`/dashboard/inventory`)

- Server Actions en `src/app/actions/inventory.ts` (`getProducts`, `createProduct`, `updateProduct`, `adjustStock`, `getStockMovements`, `uploadProductImage`), todas con guarda de rol staff y validación Zod.
- Repositorio en `src/lib/inventory/`: `supabase-repository.ts` (producción) y `demo-repository.ts` (en memoria, con 20 repuestos de ejemplo e historial). Se elige automáticamente según `.env.local`.
- Los ajustes de stock usan la función SQL `adjust_stock()`: stock + auditoría en una sola transacción.
- Las imágenes se comprimen a WebP en el navegador antes de subirse al bucket `product-images`.

> Si ya habías ejecutado una versión anterior de `schema.sql`, vuelve a ejecutarlo completo: es idempotente y agrega `adjust_stock`, `stock_status` y el motivo `damage`.

## Módulo de órdenes de trabajo (`/dashboard/orders`)

- Server Actions en `src/app/actions/orders.ts`: `getWorkOrders`, `getWorkOrderDetail`, `createWorkOrder`, `updateWorkOrderStatus`, `updateWorkOrderDetails`, `addOrderItem`, `removeOrderItem`, `addLaborItem`, `removeLaborItem` (+ búsquedas de moto por patente, clientes y repuestos).
- Vista **Tablero** (Kanban con arrastrar y soltar) o **Tabla**; búsqueda por patente, cliente o folio (`#34`, `OT-0034`).
- Detalle en `/dashboard/orders/[id]`; comprobantes imprimibles en `/print/orders/[id]?type=reception|invoice`.
- Estados: Recepcionada → En proceso ⇄ Esperando repuestos → Lista para entrega → Entregada (final). Cancelada se puede reabrir. La máquina de estados vive en `src/lib/orders/workflow.ts` y en `work_order_transition_allowed()` (SQL).
- Los repuestos asignados descuentan stock al instante con el motivo `workshop_use` («Insumo de taller») y se devuelven con `workshop_return` al quitarlos.
- **Clientes del taller** (`customers`): pueden no tener cuenta online. Si luego se registran con el mismo email, quedan vinculados automáticamente.
- Datos del taller para los comprobantes y valor hora sugerido: `src/lib/business.ts`.

> Si ya ejecutaste una versión anterior de `schema.sql`, vuelve a ejecutarlo completo: migra `motorcycles`/`appointments` para que apunten a `customers` (requiere que esas tablas estén vacías, lo normal hasta ahora).

## Módulo de citas (`/dashboard/appointments` + `/booking`)

- Server Actions en `src/app/actions/appointments.ts`: `getAppointments`, `getAppointmentDaySummary`, `getAvailableSlots`, `createAppointment` (staff o público), `updateAppointmentStatus`, `rescheduleAppointment`, `convertAppointmentToWorkOrder`.
- Vistas **Semana** (grilla horaria), **Mes** y **Lista por días**, con filtros por estado y servicio e indicadores del día.
- Estados: Por confirmar (`scheduled`) → Confirmada → Atendida (al convertir en OT); Cancelada / No asistió se reactivan reagendando.
- **Convertir en OT** crea una orden «Recepcionada» con cliente, moto, mecánico, km y motivo copiados de la cita; es idempotente (si ya existe, abre esa OT).
- **Agenda pública** en `/booking` (alias `/appointments`): 4 pasos, sin cuenta, con número de reserva `MO-XXXXXX`.
- Reglas de agenda (jornada, turnos cada 30 min, 2 motos simultáneas, duración por servicio, anticipación mínima de 60 min para el público): `src/lib/appointments/schedule.ts` y, como fuente de verdad, `assert_appointment_slot()` en SQL.
- La reserva pública pasa por `book_appointment()` (SQL): valida horario y capacidad en la base, y la disponibilidad se expone sin datos personales (`get_busy_slots()`).

> Vuelve a ejecutar `schema.sql` completo: renombra el estado `pending` → `scheduled` y agrega las funciones de agenda.

## Punto de venta (`/dashboard/pos`) y ventas (`/dashboard/sales`)

- Server Actions en `src/app/actions/pos.ts`: `processPosSale(cartItems, paymentMethod, customerId?, { applyTax, amountTendered, notes })`, `getSalesHistory(filters)`, `getSaleDetail`, `getPosCatalog`.
- Repositorio en `src/lib/sales/` (`supabase-repository.ts` / `demo-repository.ts`), elegido según `.env.local` como el resto.
- **Buscador**: SKU exacto + Enter (compatible con lector de códigos de barras), `3*SKU` agrega 3 unidades, filtros por categoría y accesos rápidos a los más vendidos (últimos 90 días). Atajos: **F2** buscar · **F9** cobrar.
- **Cobro**: efectivo (con vuelto y billetes sugeridos), débito, crédito o transferencia; IVA opcional configurable en `SALES_TAX` (`src/lib/business.ts`); cliente del taller opcional (por defecto «Consumidor final»).
- **Ticket** `V-000123`: imprimible en rollo de 80 mm (`/print/sales/[id]`) o enviado por email (abre el cliente de correo con el ticket en el cuerpo).
- En Supabase todo ocurre en `create_pos_sale()`: venta + líneas (precio del catálogo) + pago + descuento de stock en **una transacción**, con movimientos `pos_sale` («Venta en mostrador (POS)»).
- **Historial** con filtros por fechas, canal (mostrador / e-commerce), medio de pago y búsqueda por folio o cliente; detalle con ítems y datos de envío.

## Tienda online B2C (`/shop`)

- Server Actions en `src/app/actions/ecommerce.ts`: `getShopCatalog()` y `processEcommerceOrder(cartItems, customerData, shippingDetails, paymentMethod)`, públicas (sin cuenta) con honeypot anti-bots.
- Catálogo con búsqueda, categorías, rango de precio, «solo en stock» y orden (más vendidos, menor/mayor precio, nombre); los filtros quedan en la URL.
- Carrito lateral persistido en `localStorage` (sincronizado entre pestañas). En el checkout se valida contra precios y stock vigentes; el precio final siempre lo fija la base.
- Checkout: contacto, retiro en taller o envío (costo a coordinar), pago con tarjeta online, transferencia o efectivo al retirar. En Supabase pasa por `checkout_online()`: crea/reutiliza el cliente por email y descuenta stock con movimientos `online_sale` («Venta e-commerce»).
- Las rutas anteriores `/catalog` y `/checkout` redirigen a `/shop` y `/shop/checkout`.

> **Pendiente de integración:** el pago «tarjeta online» se confirma al instante (no hay pasarela conectada) y no hay proveedor de email (el ticket del POS se envía con `mailto:`).

### Tiempo real

Inventario, métricas y ventas muestran el indicador «En vivo»: con Supabase se suscriben por Realtime a `sales` y `products` (el esquema los agrega a la publicación `supabase_realtime`); además se refrescan cuando otra pestaña del navegador registra una venta y, como respaldo, periódicamente mientras la pestaña está visible. Los KPIs de ingresos salen de ventas pagadas (POS + online) y OTs entregadas.

> Vuelve a ejecutar `schema.sql` completo: agrega los motivos `pos_sale` / `online_sale`, los medios `debit_card` / `credit_card`, el folio y datos del comprador en `sales`, `create_pos_sale()`, `checkout_online()`, `get_product_popularity()` y la vista `v_sales`.

## Reglas de negocio en la base de datos

- El rol de un perfil nace `client`; solo un admin puede cambiarlo.
- Una cita solo puede usar una moto del mismo cliente (FK compuesta).
- El precio de cada `order_item` se toma del catálogo (no lo fija el cliente).
- `sales.status → 'paid'` descuenta stock y registra `inventory_movements`; `cancelled/refunded` lo repone. Sin stock suficiente la venta falla.
- `work_orders.total_amount = labor_amount + parts_amount` (repuestos vendidos en la OT).
