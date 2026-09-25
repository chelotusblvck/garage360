-- =============================================================================
-- MotoOps · Esquema inicial (Supabase / PostgreSQL 15+)
-- -----------------------------------------------------------------------------
-- Ejecutar completo en: Supabase Dashboard → SQL Editor → New query → Run.
-- Es idempotente en tipos/funciones/políticas, pensado para un proyecto nuevo.
--
-- Flujo de ventas (e-commerce, mostrador y repuestos de órdenes de trabajo):
--   1. INSERT en `sales` con status = 'pending'
--   2. INSERT de líneas en `order_items` (el precio se toma de `products`)
--   3. UPDATE `sales` SET status = 'paid'  → descuenta stock y registra
--      movimientos en `inventory_movements`. Si no hay stock suficiente,
--      la transacción falla (CHECK stock >= 0).
--   4. 'cancelled' / 'refunded' sobre una venta pagada → repone stock.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Tipos enumerados
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'mechanic', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.service_type as enum ('maintenance', 'inspection', 'repair');
exception when duplicate_object then null; end $$;

-- Nivel de combustible registrado en la recepción de la moto.
do $$ begin
  create type public.fuel_level as enum ('reserve', 'quarter', 'half', 'three_quarters', 'full');
exception when duplicate_object then null; end $$;

-- Etapa de la evidencia fotográfica de una OT.
do $$ begin
  create type public.work_order_photo_stage as enum ('reception', 'in_progress', 'delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum
    ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;
-- Versiones previas usaban 'pending' (y 'in_progress', que queda sin uso).
do $$ begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'appointment_status' and e.enumlabel = 'pending'
  ) then
    alter type public.appointment_status rename value 'pending' to 'scheduled';
  end if;
end $$;

do $$ begin
  create type public.work_order_status as enum
    ('open', 'in_progress', 'waiting_parts', 'completed', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sale_channel as enum ('online', 'pos', 'work_order');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sale_status as enum ('pending', 'paid', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'card', 'transfer', 'online');
exception when duplicate_object then null; end $$;
-- Punto de venta: débito y crédito por separado ('card' queda por compatibilidad).
alter type public.payment_method add value if not exists 'debit_card';
alter type public.payment_method add value if not exists 'credit_card';

do $$ begin
  create type public.inventory_reason as enum
    ('sale', 'sale_reversal', 'purchase', 'adjustment', 'return', 'damage',
     'workshop_use', 'workshop_return');
exception when duplicate_object then null; end $$;
-- Para bases creadas con una versión anterior del esquema.
alter type public.inventory_reason add value if not exists 'damage';
-- Insumo de taller: repuesto consumido / devuelto por una orden de trabajo.
alter type public.inventory_reason add value if not exists 'workshop_use';
alter type public.inventory_reason add value if not exists 'workshop_return';
-- Salidas por venta según canal: mostrador (POS) y tienda online.
alter type public.inventory_reason add value if not exists 'pos_sale';
alter type public.inventory_reason add value if not exists 'online_sale';

-- -----------------------------------------------------------------------------
-- 1. Utilidades genéricas
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. profiles (1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  role        public.user_role not null default 'client',
  name        text not null default '',
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint profiles_phone_format check (phone is null or phone ~ '^\+?[0-9\s\-()]{6,20}$')
);

create index if not exists profiles_role_idx on public.profiles (role);

-- Helpers de autorización (SECURITY DEFINER para evitar recursión en RLS).
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_role() in ('admin', 'mechanic'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_role() = 'admin', false);
$$;

-- Crea el perfil automáticamente al registrarse. El rol nace como 'client':
-- nunca se confía en metadata enviada por el usuario para el rol. La única
-- excepción es una invitación de staff que el admin del taller cargó en
-- workshop_staff (sección 13) con ese mismo email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;  -- workshop_staff (sección 13): se resuelve al ejecutar
begin
  insert into public.profiles (id, email, name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;

  select * into v_invite
    from public.workshop_staff
   where profile_id is null
     and email is not null
     and lower(email) = lower(new.email)
   order by created_at
   limit 1;

  if found then
    update public.profiles
       set role = v_invite.role, workshop_id = v_invite.workshop_id
     where id = new.id;
    update public.workshop_staff set profile_id = new.id where id = v_invite.id;
    return new;
  end if;

  -- Vincula (o crea) su ficha de cliente del taller: si ya lo atendimos en
  -- mostrador con el mismo email, sus motos y OTs quedan asociadas a la cuenta.
  update public.customers
     set profile_id = new.id
   where profile_id is null
     and email is not null
     and lower(email) = lower(new.email);

  if not found then
    insert into public.customers (profile_id, name, email, phone)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), new.email),
      new.email,
      new.raw_user_meta_data ->> 'phone'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impide la escalada de privilegios: solo un admin (o el service role,
-- donde auth.uid() es NULL) puede cambiar el rol de un perfil.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar roles'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2.5 customers (clientes del taller, con o sin cuenta online)
-- -----------------------------------------------------------------------------
-- Un cliente de mostrador no necesita usuario en Auth. Si luego se registra
-- con el mismo email, handle_new_user() vincula profile_id automáticamente.
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid unique references public.profiles (id) on delete set null,
  name        text not null,
  phone       text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint customers_name_length check (char_length(trim(name)) between 2 and 120),
  constraint customers_email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint customers_phone_format check (phone is null or phone ~ '^\+?[0-9\s\-()]{6,20}$')
);

create unique index if not exists customers_email_unique
  on public.customers (lower(email)) where email is not null;
create index if not exists customers_name_idx on public.customers (lower(name));

-- Ficha chilena: RUT (normalizado "12345678-9", DV en mayúscula), domicilio
-- y comuna. El RUT se valida con el dígito verificador (módulo 11).
create or replace function public.rut_is_valid(p_rut text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_body   text;
  v_sum    integer := 0;
  v_factor integer := 2;
  v_rest   integer;
begin
  if p_rut is null or p_rut !~ '^[0-9]{7,8}-[0-9K]$' then
    return false;
  end if;
  v_body := split_part(p_rut, '-', 1);
  for i in reverse length(v_body)..1 loop
    v_sum := v_sum + substr(v_body, i, 1)::integer * v_factor;
    v_factor := case when v_factor = 7 then 2 else v_factor + 1 end;
  end loop;
  v_rest := 11 - (v_sum % 11);
  return split_part(p_rut, '-', 2) =
    case v_rest when 11 then '0' when 10 then 'K' else v_rest::text end;
end;
$$;

alter table public.customers add column if not exists rut text;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists city text;

do $$ begin
  alter table public.customers
    add constraint customers_rut_valid check (rut is null or public.rut_is_valid(rut));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.customers
    add constraint customers_address_length check (
      (address is null or char_length(address) <= 160) and (city is null or char_length(city) <= 60)
    );
exception when duplicate_object then null; end $$;

create unique index if not exists customers_rut_unique
  on public.customers (rut) where rut is not null;

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create or replace function public.is_my_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customers
     where id = p_customer_id and profile_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. motorcycles
-- -----------------------------------------------------------------------------
create table if not exists public.motorcycles (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.customers (id) on delete cascade,
  brand       text not null,
  model       text not null,
  year        smallint not null,
  plate       text not null,
  vin         text,
  current_km  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Rango amplio e inmutable; el límite "año actual + 1" se valida con Zod.
  constraint motorcycles_year_range check (year between 1900 and 2100),
  constraint motorcycles_km_positive check (current_km >= 0),
  -- VIN estándar ISO 3779: 17 caracteres, sin I, O ni Q.
  constraint motorcycles_vin_format
    check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  -- Permite FKs compuestas que garantizan que la moto pertenece al cliente.
  constraint motorcycles_id_client_unique unique (id, client_id)
);

create unique index if not exists motorcycles_plate_unique
  on public.motorcycles (upper(plate));
create unique index if not exists motorcycles_vin_unique
  on public.motorcycles (vin) where vin is not null;
create index if not exists motorcycles_client_idx on public.motorcycles (client_id);

-- Migración desde versiones previas del esquema, donde motorcycles.client_id
-- apuntaba a profiles: se re-apunta a customers (requiere tabla sin filas).
do $$ begin
  if exists (
    select 1 from pg_constraint
     where conname = 'motorcycles_client_id_fkey'
       and confrelid = 'public.profiles'::regclass
  ) then
    alter table public.motorcycles drop constraint motorcycles_client_id_fkey;
    alter table public.motorcycles
      add constraint motorcycles_client_id_fkey
      foreign key (client_id) references public.customers (id) on delete cascade;
  end if;
end $$;

-- Color y observaciones de la moto (hoja de vida).
alter table public.motorcycles add column if not exists color text;
alter table public.motorcycles add column if not exists notes text;

drop trigger if exists motorcycles_updated_at on public.motorcycles;
create trigger motorcycles_updated_at
  before update on public.motorcycles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. products (inventario + catálogo e-commerce)
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  sku           text not null,
  description   text,
  price         numeric(12, 2) not null,
  cost          numeric(12, 2),
  stock         integer not null default 0,
  min_stock     integer not null default 0,
  category      text not null default 'general',
  image_url     text,
  is_active     boolean not null default true,  -- visible en el catálogo público
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint products_price_positive check (price >= 0),
  constraint products_cost_positive check (cost is null or cost >= 0),
  constraint products_stock_positive check (stock >= 0),
  constraint products_min_stock_positive check (min_stock >= 0)
);

-- Estado de stock derivado (PostgREST no compara columna contra columna,
-- así que se materializa para poder filtrar: ?stock_status=eq.low).
alter table public.products
  add column if not exists stock_status text generated always as (
    case
      when stock = 0 then 'out'
      when stock <= min_stock then 'low'
      else 'ok'
    end
  ) stored;

create index if not exists products_stock_status_idx on public.products (stock_status);
create unique index if not exists products_sku_unique on public.products (upper(sku));
create index if not exists products_category_idx on public.products (category);
create index if not exists products_low_stock_idx
  on public.products (id) where stock <= min_stock;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. appointments (agenda de servicios)
-- -----------------------------------------------------------------------------
create table if not exists public.appointments (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.customers (id) on delete cascade,
  motorcycle_id     uuid not null,
  service_type      public.service_type not null,
  scheduled_at      timestamptz not null,
  duration_minutes  smallint not null default 60,
  status            public.appointment_status not null default 'scheduled',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint appointments_duration_range check (duration_minutes between 15 and 480),
  -- La moto debe pertenecer al cliente de la cita.
  constraint appointments_motorcycle_owner_fk
    foreign key (motorcycle_id, client_id)
    references public.motorcycles (id, client_id) on delete cascade
);

create index if not exists appointments_scheduled_idx on public.appointments (scheduled_at);
create index if not exists appointments_client_idx on public.appointments (client_id);
create index if not exists appointments_status_idx on public.appointments (status);

do $$ begin
  if exists (
    select 1 from pg_constraint
     where conname = 'appointments_client_id_fkey'
       and confrelid = 'public.profiles'::regclass
  ) then
    alter table public.appointments drop constraint appointments_client_id_fkey;
    alter table public.appointments
      add constraint appointments_client_id_fkey
      foreign key (client_id) references public.customers (id) on delete cascade;
  end if;
end $$;

-- Código de reserva (se muestra como MO-XXXXXX), origen y datos de contacto
-- tal como los ingresó quien reservó.
alter table public.appointments add column if not exists booking_code text;
alter table public.appointments add column if not exists source text not null default 'staff';
alter table public.appointments add column if not exists contact_name text;
alter table public.appointments add column if not exists contact_phone text;
alter table public.appointments add column if not exists contact_email text;
alter table public.appointments alter column status set default 'scheduled';

do $$ begin
  alter table public.appointments
    add constraint appointments_source_check check (source in ('staff', 'public'));
exception when duplicate_object then null; end $$;

create unique index if not exists appointments_booking_code_unique
  on public.appointments (booking_code) where booking_code is not null;

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. work_orders (órdenes de trabajo del taller)
-- -----------------------------------------------------------------------------
create table if not exists public.work_orders (
  id              uuid primary key default gen_random_uuid(),
  motorcycle_id   uuid not null references public.motorcycles (id) on delete restrict,
  appointment_id  uuid references public.appointments (id) on delete set null,
  mechanic_id     uuid references public.profiles (id) on delete set null,
  status          public.work_order_status not null default 'open',
  notes           text,
  km_at_intake    integer,
  -- labor_amount / parts_amount los mantiene refresh_work_order_totals()
  -- a partir de work_order_labor y work_order_parts.
  labor_amount    numeric(12, 2) not null default 0,
  parts_amount    numeric(12, 2) not null default 0,
  total_amount    numeric(12, 2) generated always as (labor_amount + parts_amount) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz,
  constraint work_orders_labor_positive check (labor_amount >= 0),
  constraint work_orders_parts_positive check (parts_amount >= 0),
  constraint work_orders_km_positive check (km_at_intake is null or km_at_intake >= 0)
);

create index if not exists work_orders_motorcycle_idx on public.work_orders (motorcycle_id);
create index if not exists work_orders_mechanic_idx on public.work_orders (mechanic_id);
create index if not exists work_orders_status_idx on public.work_orders (status);
create index if not exists work_orders_created_idx on public.work_orders (created_at desc);

-- Folio legible (OT-0001), motivo de ingreso, diagnóstico y fecha de entrega.
alter table public.work_orders
  add column if not exists number bigint generated always as identity;
alter table public.work_orders
  add column if not exists intake_reason text not null default '';
alter table public.work_orders add column if not exists diagnosis text;
alter table public.work_orders add column if not exists delivered_at timestamptz;
alter table public.work_orders add column if not exists fuel_level public.fuel_level;
create unique index if not exists work_orders_number_unique on public.work_orders (number);

-- Máquina de estados de la OT:
--   open ⇄ in_progress ⇄ waiting_parts ⇄ completed → delivered (final)
--   cualquier estado activo → cancelled → open (reapertura)
create or replace function public.work_order_transition_allowed(
  p_from public.work_order_status,
  p_to   public.work_order_status
)
returns boolean
language sql
immutable
as $$
  select case
    when p_from = p_to then true
    when p_from in ('open', 'in_progress', 'waiting_parts', 'completed')
     and p_to   in ('open', 'in_progress', 'waiting_parts', 'completed', 'cancelled') then true
    when p_from = 'completed' and p_to = 'delivered' then true
    when p_from = 'cancelled' and p_to = 'open' then true
    else false
  end;
$$;

-- Solo perfiles admin/mechanic pueden asignarse como mecánico.
create or replace function public.validate_work_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mechanic_id is not null and not exists (
    select 1 from public.profiles
    where id = new.mechanic_id and role in ('admin', 'mechanic')
  ) then
    raise exception 'mechanic_id debe ser un perfil con rol mechanic o admin'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not public.work_order_transition_allowed(old.status, new.status) then
      raise exception 'Transición de estado no permitida'
        using errcode = '22023';
    end if;

    if new.status = 'cancelled' and exists (
      select 1 from public.work_order_parts where work_order_id = new.id
    ) then
      raise exception 'Quita los repuestos de la orden antes de cancelarla (se devuelven al stock)'
        using errcode = '22023';
    end if;

    -- Reapertura: limpia fechas de cierre.
    if new.status in ('open', 'in_progress', 'waiting_parts') then
      new.completed_at := null;
      new.delivered_at := null;
    end if;

    if new.status = 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
    end if;
  end if;

  if new.status in ('completed', 'delivered') and new.completed_at is null then
    new.completed_at := now();
  end if;

  -- Actualiza el odómetro de la moto si el ingreso trae más km.
  if new.km_at_intake is not null then
    update public.motorcycles
       set current_km = new.km_at_intake
     where id = new.motorcycle_id and current_km < new.km_at_intake;
  end if;

  return new;
end;
$$;

drop trigger if exists work_orders_validate on public.work_orders;
create trigger work_orders_validate
  before insert or update on public.work_orders
  for each row execute function public.validate_work_order();

drop trigger if exists work_orders_updated_at on public.work_orders;
create trigger work_orders_updated_at
  before update on public.work_orders
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. sales + order_items (transacciones e-commerce, mostrador y taller)
-- -----------------------------------------------------------------------------
create table if not exists public.sales (
  id               uuid primary key default gen_random_uuid(),
  channel          public.sale_channel not null,
  status           public.sale_status not null default 'pending',
  client_id        uuid references public.profiles (id) on delete set null,
  -- RESTRICT: una OT con repuestos facturados se cancela, no se borra.
  work_order_id    uuid references public.work_orders (id) on delete restrict,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  payment_method   public.payment_method,
  subtotal         numeric(12, 2) not null default 0,  -- mantenido por trigger
  discount         numeric(12, 2) not null default 0,
  tax              numeric(12, 2) not null default 0,
  total            numeric(12, 2) generated always as (subtotal - discount + tax) stored,
  shipping_address jsonb,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint sales_amounts_positive check (subtotal >= 0 and discount >= 0 and tax >= 0),
  constraint sales_discount_le_subtotal check (discount <= subtotal),
  constraint sales_work_order_channel check (
    (channel = 'work_order') = (work_order_id is not null)
  ),
  constraint sales_online_has_client check (channel <> 'online' or client_id is not null)
);

create index if not exists sales_client_idx on public.sales (client_id);
create index if not exists sales_work_order_idx on public.sales (work_order_id);
create index if not exists sales_status_created_idx on public.sales (status, created_at desc);
create index if not exists sales_paid_at_idx on public.sales (paid_at) where status = 'paid';

drop trigger if exists sales_updated_at on public.sales;
create trigger sales_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

-- Folio correlativo (n.º de ticket / pedido) y datos del comprador. Un cliente
-- de mostrador o un comprador online sin cuenta se registra en `customers`.
alter table public.sales
  add column if not exists number          bigint generated by default as identity,
  add column if not exists customer_id     uuid references public.customers (id) on delete set null,
  add column if not exists contact_name    text,
  add column if not exists contact_email   text,
  add column if not exists contact_phone   text,
  add column if not exists fulfillment     text,             -- online: 'pickup' | 'delivery'
  add column if not exists amount_tendered numeric(12, 2),   -- efectivo recibido (POS)
  add column if not exists notes           text;

create unique index if not exists sales_number_unique on public.sales (number);
create index if not exists sales_customer_idx on public.sales (customer_id);
create index if not exists sales_channel_paid_idx on public.sales (channel, paid_at desc) where status = 'paid';

-- La compra online admite invitados: basta con un cliente del taller.
alter table public.sales drop constraint if exists sales_online_has_client;
alter table public.sales add constraint sales_online_has_client
  check (channel <> 'online' or client_id is not null or customer_id is not null);
alter table public.sales drop constraint if exists sales_fulfillment_valid;
alter table public.sales add constraint sales_fulfillment_valid
  check (fulfillment is null or fulfillment in ('pickup', 'delivery'));
alter table public.sales drop constraint if exists sales_tendered_positive;
alter table public.sales add constraint sales_tendered_positive
  check (amount_tendered is null or amount_tendered >= 0);

create or replace function public.sale_folio(p_number bigint)
returns text
language sql
immutable
as $$
  select 'V-' || lpad(p_number::text, 6, '0');
$$;

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete restrict,
  quantity    integer not null,
  unit_price  numeric(12, 2) not null,
  line_total  numeric(12, 2) generated always as (quantity * unit_price) stored,
  created_at  timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_price_positive check (unit_price >= 0)
);

create index if not exists order_items_sale_idx on public.order_items (sale_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

-- Auditoría de cada movimiento de stock.
create table if not exists public.inventory_movements (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references public.products (id) on delete cascade,
  quantity    integer not null,          -- negativo = salida, positivo = entrada
  reason      public.inventory_reason not null,
  sale_id     uuid references public.sales (id) on delete set null,
  note        text,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint inventory_movements_nonzero check (quantity <> 0)
);

create index if not exists inventory_movements_product_idx
  on public.inventory_movements (product_id, created_at desc);

-- 7.1 Las líneas solo se editan mientras la venta está 'pending', y el precio
--     unitario se toma SIEMPRE del catálogo (el cliente no puede fijarlo).
create or replace function public.prepare_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.sale_status;
begin
  select status into v_status
    from public.sales
   where id = coalesce(new.sale_id, old.sale_id);

  -- Borrado en cascada de una venta pendiente/cancelada: la venta ya no existe.
  if tg_op = 'DELETE' and v_status is null then
    return old;
  end if;

  if v_status is distinct from 'pending' then
    raise exception 'Solo se pueden modificar ítems de ventas pendientes'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'INSERT' or new.product_id is distinct from old.product_id then
    select price into new.unit_price
      from public.products
     where id = new.product_id and is_active;

    if new.unit_price is null then
      raise exception 'Producto inexistente o inactivo' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_prepare on public.order_items;
create trigger order_items_prepare
  before insert or update or delete on public.order_items
  for each row execute function public.prepare_order_item();

-- 7.2 Recalcula el subtotal de la venta.
create or replace function public.refresh_sale_subtotal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid := coalesce(new.sale_id, old.sale_id);
begin
  update public.sales s
     set subtotal = coalesce((
           select sum(line_total) from public.order_items where sale_id = v_sale_id
         ), 0)
   where s.id = v_sale_id;
  return null;
end;
$$;

drop trigger if exists order_items_refresh_subtotal on public.order_items;
create trigger order_items_refresh_subtotal
  after insert or update or delete on public.order_items
  for each row execute function public.refresh_sale_subtotal();

-- 7.3 Aplica / revierte stock en los cambios de estado de la venta.
create or replace function public.apply_sale_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason public.inventory_reason;
  v_short  record;
begin
  -- pending → paid : descuenta stock (motivo según canal: mostrador / online)
  if new.status = 'paid' and old.status is distinct from 'paid' then
    v_reason := case new.channel
                  when 'pos'    then 'pos_sale'
                  when 'online' then 'online_sale'
                  else 'sale'
                end;

    -- Bloquea las filas (orden fijo, sin deadlocks) y avisa qué producto falta.
    perform 1 from public.products
     where id in (select product_id from public.order_items where sale_id = new.id)
     order by id
       for update;

    select p.name, p.stock, agg.qty into v_short
      from (
        select product_id, sum(quantity) as qty
          from public.order_items
         where sale_id = new.id
         group by product_id
      ) agg
      join public.products p on p.id = agg.product_id
     where p.stock < agg.qty
     limit 1;

    if found then
      raise exception 'Stock insuficiente para «%»: quedan % u. y se piden %',
        v_short.name, v_short.stock, v_short.qty
        using errcode = '23514';
    end if;

    update public.products p
       set stock = p.stock - agg.qty
      from (
        select product_id, sum(quantity) as qty
          from public.order_items
         where sale_id = new.id
         group by product_id
      ) agg
     where p.id = agg.product_id;

    insert into public.inventory_movements (product_id, quantity, reason, sale_id, note)
    select product_id, -sum(quantity), v_reason, new.id, public.sale_folio(new.number)
      from public.order_items
     where sale_id = new.id
     group by product_id;

    new.paid_at := coalesce(new.paid_at, now());

  -- paid → cancelled/refunded : repone stock
  elsif old.status = 'paid' and new.status in ('cancelled', 'refunded') then
    update public.products p
       set stock = p.stock + agg.qty
      from (
        select product_id, sum(quantity) as qty
          from public.order_items
         where sale_id = new.id
         group by product_id
      ) agg
     where p.id = agg.product_id;

    insert into public.inventory_movements (product_id, quantity, reason, sale_id, note)
    select product_id, sum(quantity), 'sale_reversal', new.id, public.sale_folio(new.number) || ' (anulación)'
      from public.order_items
     where sale_id = new.id
     group by product_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sales_apply_stock on public.sales;
create trigger sales_apply_stock
  before update of status on public.sales
  for each row execute function public.apply_sale_stock();

-- 7.4 (Versiones previas sumaban a la OT las ventas channel = 'work_order'.
--     Ahora los repuestos de taller viven en work_order_parts: ver 7.6.)
drop trigger if exists sales_refresh_work_order on public.sales;
drop function if exists public.refresh_work_order_parts();

-- -----------------------------------------------------------------------------
-- 7.5 Control manual de stock
-- -----------------------------------------------------------------------------
-- Registra el stock con el que nace un producto.
create or replace function public.log_initial_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock > 0 then
    insert into public.inventory_movements (product_id, quantity, reason, note)
    values (new.id, new.stock, 'purchase', 'Stock inicial');
  end if;
  return null;
end;
$$;

drop trigger if exists products_initial_stock on public.products;
create trigger products_initial_stock
  after insert on public.products
  for each row execute function public.log_initial_stock();

-- Ajuste manual atómico: modifica el stock y deja registro de auditoría en
-- la misma transacción. p_quantity con signo (+ entrada / − salida).
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_quantity   integer,
  p_reason     public.inventory_reason,
  p_note       text default null
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity = 0 then
    raise exception 'La cantidad no puede ser 0' using errcode = '22023';
  end if;

  if p_reason in ('sale', 'sale_reversal', 'workshop_use', 'workshop_return', 'pos_sale', 'online_sale') then
    raise exception 'Motivo reservado para ventas y órdenes de trabajo' using errcode = '22023';
  end if;

  update public.products
     set stock = stock + p_quantity
   where id = p_product_id
  returning * into v_product;

  if not found then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;

  insert into public.inventory_movements (product_id, quantity, reason, note)
  values (p_product_id, p_quantity, p_reason, nullif(trim(p_note), ''));

  return v_product;
exception
  when check_violation then
    raise exception 'Stock insuficiente: no puedes retirar más unidades de las disponibles'
      using errcode = '23514';
end;
$$;

revoke execute on function public.adjust_stock(uuid, integer, public.inventory_reason, text)
  from public, anon;
grant execute on function public.adjust_stock(uuid, integer, public.inventory_reason, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 7.6 Órdenes de trabajo: repuestos, mano de obra y alta atómica
-- -----------------------------------------------------------------------------
create table if not exists public.work_order_parts (
  id             uuid primary key default gen_random_uuid(),
  -- RESTRICT: una OT con repuestos se cancela (devolviendo stock), no se borra.
  work_order_id  uuid not null references public.work_orders (id) on delete restrict,
  product_id     uuid not null references public.products (id) on delete restrict,
  quantity       integer not null,
  unit_price     numeric(12, 2) not null,
  line_total     numeric(12, 2) generated always as (quantity * unit_price) stored,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint work_order_parts_quantity_positive check (quantity > 0),
  constraint work_order_parts_price_positive check (unit_price >= 0)
);

create index if not exists work_order_parts_order_idx on public.work_order_parts (work_order_id);
create index if not exists work_order_parts_product_idx on public.work_order_parts (product_id);

create table if not exists public.work_order_labor (
  id             uuid primary key default gen_random_uuid(),
  work_order_id  uuid not null references public.work_orders (id) on delete cascade,
  description    text not null,
  hours          numeric(6, 2) not null,
  hourly_rate    numeric(12, 2) not null,
  line_total     numeric(12, 2) generated always as (round(hours * hourly_rate, 2)) stored,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint work_order_labor_description check (char_length(trim(description)) between 2 and 200),
  constraint work_order_labor_hours check (hours > 0 and hours <= 200),
  constraint work_order_labor_rate check (hourly_rate >= 0)
);

create index if not exists work_order_labor_order_idx on public.work_order_labor (work_order_id);

-- Trazabilidad: qué OT consumió cada unidad de stock.
alter table public.inventory_movements
  add column if not exists work_order_id uuid references public.work_orders (id) on delete set null;
create index if not exists inventory_movements_work_order_idx
  on public.inventory_movements (work_order_id) where work_order_id is not null;

create or replace function public.work_order_folio(p_number bigint)
returns text
language sql
immutable
as $$
  select 'OT-' || lpad(p_number::text, 4, '0');
$$;

-- Bloquea cambios en OTs entregadas o canceladas.
create or replace function public.assert_work_order_editable(p_work_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.work_order_status;
begin
  select status into v_status from public.work_orders where id = p_work_order_id;
  if not found then
    raise exception 'Orden de trabajo no encontrada' using errcode = 'P0002';
  end if;
  if v_status in ('delivered', 'cancelled') then
    raise exception 'La orden está cerrada y no admite cambios' using errcode = '55000';
  end if;
end;
$$;

-- Recalcula subtotales de la OT (total_amount es columna generada).
create or replace function public.refresh_work_order_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(new.work_order_id, old.work_order_id);
begin
  update public.work_orders w
     set parts_amount = coalesce((
           select sum(line_total) from public.work_order_parts where work_order_id = v_id
         ), 0),
         labor_amount = coalesce((
           select sum(line_total) from public.work_order_labor where work_order_id = v_id
         ), 0)
   where w.id = v_id;
  return null;
end;
$$;

drop trigger if exists work_order_parts_totals on public.work_order_parts;
create trigger work_order_parts_totals
  after insert or update or delete on public.work_order_parts
  for each row execute function public.refresh_work_order_totals();

drop trigger if exists work_order_labor_totals on public.work_order_labor;
create trigger work_order_labor_totals
  after insert or update or delete on public.work_order_labor
  for each row execute function public.refresh_work_order_totals();

create or replace function public.guard_work_order_labor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_work_order_editable(coalesce(new.work_order_id, old.work_order_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists work_order_labor_guard on public.work_order_labor;
create trigger work_order_labor_guard
  before insert or update or delete on public.work_order_labor
  for each row execute function public.guard_work_order_labor();

-- Asigna un repuesto a la OT: descuenta stock + registra movimiento
-- 'workshop_use' (insumo de taller) en una sola transacción.
create or replace function public.add_work_order_part(
  p_work_order_id uuid,
  p_product_id    uuid,
  p_quantity      integer,
  p_unit_price    numeric default null
)
returns public.work_order_parts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number  bigint;
  v_price   numeric;
  v_part    public.work_order_parts;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a 0' using errcode = '22023';
  end if;
  if p_unit_price is not null and p_unit_price < 0 then
    raise exception 'El precio no puede ser negativo' using errcode = '22023';
  end if;

  perform public.assert_work_order_editable(p_work_order_id);
  select number into v_number from public.work_orders where id = p_work_order_id for update;

  update public.products
     set stock = stock - p_quantity
   where id = p_product_id
  returning price into v_price;

  if not found then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;

  insert into public.work_order_parts (work_order_id, product_id, quantity, unit_price)
  values (p_work_order_id, p_product_id, p_quantity, coalesce(p_unit_price, v_price))
  returning * into v_part;

  insert into public.inventory_movements (product_id, quantity, reason, note, work_order_id)
  values (p_product_id, -p_quantity, 'workshop_use', public.work_order_folio(v_number), p_work_order_id);

  return v_part;
exception
  when check_violation then
    raise exception 'Stock insuficiente: no hay unidades suficientes en inventario'
      using errcode = '23514';
end;
$$;

-- Quita un repuesto de la OT y devuelve las unidades al inventario.
create or replace function public.remove_work_order_part(
  p_work_order_id uuid,
  p_part_id       uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part   public.work_order_parts;
  v_number bigint;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_part
    from public.work_order_parts
   where id = p_part_id and work_order_id = p_work_order_id
     for update;
  if not found then
    raise exception 'El repuesto no pertenece a esta orden' using errcode = 'P0002';
  end if;

  perform public.assert_work_order_editable(p_work_order_id);
  select number into v_number from public.work_orders where id = p_work_order_id;

  update public.products set stock = stock + v_part.quantity where id = v_part.product_id;

  insert into public.inventory_movements (product_id, quantity, reason, note, work_order_id)
  values (v_part.product_id, v_part.quantity, 'workshop_return',
          public.work_order_folio(v_number) || ' (devolución)', p_work_order_id);

  delete from public.work_order_parts where id = p_part_id;
end;
$$;

-- Alta de OT en una transacción: moto existente, o moto nueva con cliente
-- existente / nuevo.
create or replace function public.create_work_order(
  p_intake_reason  text,
  p_km             integer,
  p_motorcycle_id  uuid     default null,
  p_mechanic_id    uuid     default null,
  p_customer_id    uuid     default null,
  p_customer_name  text     default null,
  p_customer_phone text     default null,
  p_customer_email text     default null,
  p_brand          text     default null,
  p_model          text     default null,
  p_year           smallint default null,
  p_plate          text     default null,
  p_vin            text     default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id   uuid := p_customer_id;
  v_motorcycle_id uuid := p_motorcycle_id;
  v_current_km    integer;
  v_order         public.work_orders;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_intake_reason, ''))) < 5 then
    raise exception 'Describe el motivo de ingreso' using errcode = '22023';
  end if;
  if p_km is null or p_km < 0 then
    raise exception 'Kilometraje inválido' using errcode = '22023';
  end if;

  if v_motorcycle_id is null then
    if v_customer_id is null then
      insert into public.customers (name, phone, email)
      values (trim(p_customer_name), nullif(trim(p_customer_phone), ''), nullif(lower(trim(p_customer_email)), ''))
      returning id into v_customer_id;
    end if;

    insert into public.motorcycles (client_id, brand, model, year, plate, vin, current_km)
    values (v_customer_id, trim(p_brand), trim(p_model), p_year, upper(trim(p_plate)),
            nullif(upper(trim(p_vin)), ''), p_km)
    returning id into v_motorcycle_id;
  else
    select current_km into v_current_km from public.motorcycles where id = v_motorcycle_id;
    if not found then
      raise exception 'Moto no encontrada' using errcode = 'P0002';
    end if;
    if p_km < v_current_km then
      raise exception 'El kilometraje es menor al último registrado (% km)', v_current_km
        using errcode = '22023';
    end if;
  end if;

  insert into public.work_orders (motorcycle_id, mechanic_id, intake_reason, km_at_intake)
  values (v_motorcycle_id, p_mechanic_id, trim(p_intake_reason), p_km)
  returning * into v_order;

  return v_order;
end;
$$;

revoke execute on function public.add_work_order_part(uuid, uuid, integer, numeric) from public, anon;
grant execute on function public.add_work_order_part(uuid, uuid, integer, numeric) to authenticated;
revoke execute on function public.remove_work_order_part(uuid, uuid) from public, anon;
grant execute on function public.remove_work_order_part(uuid, uuid) to authenticated;
revoke execute on function public.create_work_order(text, integer, uuid, uuid, uuid, text, text, text, text, text, smallint, text, text) from public, anon;
grant execute on function public.create_work_order(text, integer, uuid, uuid, uuid, text, text, text, text, text, smallint, text, text) to authenticated;

-- Vista de listado/búsqueda (respeta RLS de las tablas base).
create or replace view public.v_work_orders
with (security_invoker = true) as
select w.id,
       w.number,
       public.work_order_folio(w.number) as folio,
       w.status,
       w.intake_reason,
       w.diagnosis,
       w.km_at_intake,
       w.parts_amount,
       w.labor_amount,
       w.total_amount,
       w.created_at,
       w.updated_at,
       w.completed_at,
       w.delivered_at,
       w.mechanic_id,
       mech.name  as mechanic_name,
       m.id       as motorcycle_id,
       m.brand,
       m.model,
       m.year,
       m.plate,
       m.vin,
       m.current_km,
       c.id       as customer_id,
       c.name     as customer_name,
       c.phone    as customer_phone,
       c.email    as customer_email,
       lower(concat_ws(' ', public.work_order_folio(w.number), w.number::text,
                       m.plate, c.name, m.brand, m.model)) as search,
       w.appointment_id,
       ap.booking_code as appointment_code,
       w.fuel_level
  from public.work_orders w
  join public.motorcycles m on m.id = w.motorcycle_id
  join public.customers c on c.id = m.client_id
  left join public.profiles mech on mech.id = w.mechanic_id
  left join public.appointments ap on ap.id = w.appointment_id;

-- -----------------------------------------------------------------------------
-- 7.6.1 Evidencia fotográfica de la OT (recepción, proceso y entrega)
-- -----------------------------------------------------------------------------
-- Los archivos viven en el bucket privado 'work-order-photos' (sección 11)
-- con ruta <work_order_id>/<etapa>/<uuid>.<ext>; la app los sirve con URLs
-- firmadas de corta duración.
create table if not exists public.work_order_photos (
  id             uuid primary key default gen_random_uuid(),
  work_order_id  uuid not null references public.work_orders (id) on delete cascade,
  stage          public.work_order_photo_stage not null,
  storage_path   text not null,
  caption        text,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint work_order_photos_path_unique unique (storage_path),
  constraint work_order_photos_caption_length check (caption is null or char_length(caption) <= 140)
);

create index if not exists work_order_photos_order_idx
  on public.work_order_photos (work_order_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 7.6.1.1 Recepción (check-in): la ÚNICA vía para crear una OT desde la app
-- -----------------------------------------------------------------------------
-- Exige las fotos de ingreso (tablero, costado izquierdo y derecho), subidas
-- antes al área temporal 'checkin/' del bucket. En una transacción: convierte
-- la cita (queda 'completed') o crea la OT del ingreso espontáneo, registra
-- combustible y motivo, y asocia las fotos en la etapa 'reception'.
-- p_photos: [{"path": "checkin/<uuid>.webp", "slot": "dashboard", "caption": "…"}, …]
create or replace function public.check_in_work_order(
  p_intake_reason  text,
  p_km             integer,
  p_fuel_level     public.fuel_level,
  p_photos         jsonb,
  p_appointment_id uuid     default null,
  p_mechanic_id    uuid     default null,
  p_motorcycle_id  uuid     default null,
  p_customer_id    uuid     default null,
  p_customer_name  text     default null,
  p_customer_phone text     default null,
  p_customer_email text     default null,
  p_brand          text     default null,
  p_model          text     default null,
  p_year           smallint default null,
  p_plate          text     default null,
  p_vin            text     default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_photos  jsonb := coalesce(p_photos, '[]'::jsonb);
  v_missing text[];
  v_wo_id   uuid;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_fuel_level is null then
    raise exception 'Indica el nivel de combustible' using errcode = '22023';
  end if;
  if jsonb_typeof(v_photos) <> 'array' or jsonb_array_length(v_photos) > 16 then
    raise exception 'Listado de fotos inválido' using errcode = '22023';
  end if;

  select array_agg(slot) into v_missing
    from unnest(array['dashboard', 'left', 'right']) as slot
   where not exists (select 1 from jsonb_array_elements(v_photos) p where p ->> 'slot' = slot);
  if v_missing is not null then
    raise exception 'Faltan fotos obligatorias de recepción: %', array_to_string(v_missing, ', ')
      using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_photos) p
     where coalesce(p ->> 'path', '') !~ '^checkin/[0-9a-f-]{36}\.(webp|jpeg|png|avif)$'
        or coalesce(p ->> 'slot', '') not in ('dashboard', 'left', 'right', 'damage')
  ) then
    raise exception 'Hay una foto de recepción inválida' using errcode = '22023';
  end if;

  if p_appointment_id is not null then
    if exists (select 1 from public.work_orders where appointment_id = p_appointment_id) then
      raise exception 'La cita ya fue recepcionada' using errcode = '55000';
    end if;
    v_wo_id := public.convert_appointment_to_work_order(p_appointment_id, p_mechanic_id, p_km);
  else
    select (public.create_work_order(
      p_intake_reason, p_km, p_motorcycle_id, p_mechanic_id, p_customer_id,
      p_customer_name, p_customer_phone, p_customer_email,
      p_brand, p_model, p_year, p_plate, p_vin
    )).id into v_wo_id;
  end if;

  if char_length(trim(coalesce(p_intake_reason, ''))) < 5 then
    raise exception 'Describe el motivo de ingreso' using errcode = '22023';
  end if;
  update public.work_orders
     set fuel_level = p_fuel_level,
         intake_reason = trim(p_intake_reason)
   where id = v_wo_id;

  -- created_at escalonado: conserva el orden de captura.
  insert into public.work_order_photos (work_order_id, stage, storage_path, caption, created_at)
  select v_wo_id, 'reception', p ->> 'path', nullif(trim(p ->> 'caption'), ''),
         now() + (ord * interval '1 millisecond')
    from jsonb_array_elements(v_photos) with ordinality as t(p, ord);

  return v_wo_id;
end;
$$;

revoke execute on function public.check_in_work_order(text, integer, public.fuel_level, jsonb, uuid, uuid, uuid, uuid, text, text, text, text, text, smallint, text, text) from public, anon;
grant execute on function public.check_in_work_order(text, integer, public.fuel_level, jsonb, uuid, uuid, uuid, uuid, text, text, text, text, text, smallint, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 7.6.2 Listado de clientes (búsqueda global y resumen de motos / visitas)
-- -----------------------------------------------------------------------------
-- search: nombre, RUT (con y sin guion), email, teléfono (solo dígitos),
-- comuna, patentes y marca / modelo de sus motos.
create or replace view public.v_customers
with (security_invoker = true) as
select c.id,
       c.name,
       c.rut,
       c.phone,
       c.email,
       c.address,
       c.city,
       c.created_at,
       coalesce(m.motorcycles, '[]'::jsonb) as motorcycles,
       coalesce(v.order_count, 0)          as order_count,
       v.last_visit_at,
       lower(concat_ws(' ', c.name, c.rut, replace(c.rut, '-', ''), c.email,
                       regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'),
                       c.city, m.search)) as search
  from public.customers c
  left join lateral (
    select jsonb_agg(jsonb_build_object('brand', mm.brand, 'model', mm.model, 'plate', mm.plate)
                     order by mm.created_at) as motorcycles,
           string_agg(concat_ws(' ', mm.plate, mm.brand, mm.model), ' ') as search
      from public.motorcycles mm
     where mm.client_id = c.id
  ) m on true
  left join lateral (
    select count(*)          as order_count,
           max(w.created_at) as last_visit_at
      from public.work_orders w
      join public.motorcycles mm on mm.id = w.motorcycle_id
     where mm.client_id = c.id
       and w.status <> 'cancelled'
  ) v on true;

-- -----------------------------------------------------------------------------
-- 7.7 Agenda: reservas, disponibilidad y conversión a OT
-- -----------------------------------------------------------------------------
-- Reglas de agenda (espejo de src/lib/appointments/schedule.ts):
--   · Zona horaria del taller: America/Santiago
--   · Lun–Vie 09:00–18:00, Sáb 09:00–13:00, Dom cerrado
--   · Turnos cada 30 min; capacidad: 2 motos en simultáneo (boxes)
--   · Duración: mantenimiento 90 min; revisión y diagnóstico 60 min
--   · Público: mínimo 60 min de anticipación; máximo 60 días

-- Una cita genera como máximo una OT.
create unique index if not exists work_orders_appointment_unique
  on public.work_orders (appointment_id) where appointment_id is not null;

create or replace function public.appointment_duration(p_service public.service_type)
returns integer
language sql
immutable
as $$
  select case p_service when 'maintenance' then 90 else 60 end;
$$;

create or replace function public.appointment_transition_allowed(
  p_from public.appointment_status,
  p_to   public.appointment_status
)
returns boolean
language sql
immutable
as $$
  select case
    when p_from = p_to then true
    when p_from = 'scheduled' and p_to in ('confirmed', 'completed', 'cancelled', 'no_show') then true
    when p_from = 'confirmed' and p_to in ('completed', 'cancelled', 'no_show') then true
    -- Reactivación (solo vía reschedule_appointment, que revalida el horario).
    when p_from in ('cancelled', 'no_show') and p_to = 'scheduled' then true
    else false
  end;
$$;

create or replace function public.validate_appointment()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and not public.appointment_transition_allowed(old.status, new.status) then
    raise exception 'Transición de estado de cita no permitida' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_validate on public.appointments;
create trigger appointments_validate
  before update on public.appointments
  for each row execute function public.validate_appointment();

-- Valida que un turno respete la jornada, la anticipación y la capacidad.
create or replace function public.assert_appointment_slot(
  p_start    timestamptz,
  p_minutes  integer,
  p_exclude  uuid     default null,
  p_min_lead interval default interval '0 minutes'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp := p_start at time zone 'America/Santiago';
  v_end   timestamp := v_local + make_interval(mins => p_minutes);
  v_open  time;
  v_close time;
  v_t     timestamptz;
  v_busy  integer;
begin
  if p_start < now() + p_min_lead then
    raise exception 'Ese horario ya pasó o es demasiado próximo. Elige otro.' using errcode = '22023';
  end if;
  if p_start > now() + interval '60 days' then
    raise exception 'Solo se puede reservar con hasta 60 días de anticipación' using errcode = '22023';
  end if;
  if extract(minute from v_local)::int % 30 <> 0 or extract(second from v_local) <> 0 then
    raise exception 'Los turnos comienzan cada 30 minutos' using errcode = '22023';
  end if;

  case extract(isodow from v_local)::int
    when 7 then raise exception 'El taller no atiende los domingos' using errcode = '22023';
    when 6 then v_open := '09:00'; v_close := '13:00';
    else v_open := '09:00'; v_close := '18:00';
  end case;

  if v_local::time < v_open or v_end::date <> v_local::date or v_end::time > v_close then
    raise exception 'El turno queda fuera del horario de atención' using errcode = '22023';
  end if;

  -- Capacidad por franja de 30 min dentro del turno.
  for v_t in
    select generate_series(p_start, p_start + make_interval(mins => p_minutes - 30), interval '30 minutes')
  loop
    select count(*) into v_busy
      from public.appointments
     where status in ('scheduled', 'confirmed')
       and (p_exclude is null or id <> p_exclude)
       and scheduled_at <= v_t
       and scheduled_at + make_interval(mins => duration_minutes) > v_t;
    if v_busy >= 2 then
      raise exception 'Ese horario ya está completo. Elige otro.' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- Ocupación sin datos personales (para la agenda pública).
create or replace function public.get_busy_slots(p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, minutes integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_to - p_from > interval '62 days' then
    raise exception 'Rango demasiado amplio' using errcode = '22023';
  end if;
  return query
    select a.scheduled_at, a.duration_minutes::integer
      from public.appointments a
     where a.status in ('scheduled', 'confirmed')
       and a.scheduled_at < p_to
       and a.scheduled_at + make_interval(mins => a.duration_minutes) > p_from;
end;
$$;

-- Reserva de turno (pública o interna). Resuelve/crea cliente y moto.
create or replace function public.book_appointment(
  p_service        public.service_type,
  p_start          timestamptz,
  p_notes          text     default null,
  p_customer_name  text     default null,
  p_customer_phone text     default null,
  p_customer_email text     default null,
  p_brand          text     default null,
  p_model          text     default null,
  p_year           smallint default null,
  p_plate          text     default null,
  p_motorcycle_id  uuid     default null,
  p_customer_id    uuid     default null
)
returns table (id uuid, booking_code text, scheduled_at timestamptz, duration_minutes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff       boolean := public.is_staff();
  v_minutes     integer := public.appointment_duration(p_service);
  v_plate       text    := upper(regexp_replace(coalesce(p_plate, ''), '[\s.\-]', '', 'g'));
  v_email       text    := nullif(lower(trim(coalesce(p_customer_email, ''))), '');
  v_customer_id uuid;
  v_moto_id     uuid;
  v_code        text;
  v_id          uuid;
begin
  if not v_staff and (p_motorcycle_id is not null or p_customer_id is not null) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Observaciones demasiado largas' using errcode = '22023';
  end if;

  -- Serializa reservas concurrentes para respetar la capacidad.
  perform pg_advisory_xact_lock(hashtext('motoops.appointments'));
  perform public.assert_appointment_slot(
    p_start, v_minutes, null,
    case when v_staff then interval '0 minutes' else interval '60 minutes' end
  );

  if p_motorcycle_id is not null then
    select m.id, m.client_id into v_moto_id, v_customer_id
      from public.motorcycles m where m.id = p_motorcycle_id;
    if not found then
      raise exception 'Moto no encontrada' using errcode = 'P0002';
    end if;
  else
    if char_length(trim(coalesce(p_customer_name, ''))) < 2 then
      raise exception 'Ingresa el nombre del cliente' using errcode = '22023';
    end if;
    if coalesce(p_customer_phone, '') !~ '^\+?[0-9\s\-()]{6,20}$' then
      raise exception 'Teléfono inválido' using errcode = '22023';
    end if;
    if v_plate !~ '^[A-Z0-9]{5,8}$' then
      raise exception 'Patente inválida' using errcode = '22023';
    end if;

    -- ¿La moto ya vino al taller? Se vincula a su ficha (se verifica en recepción).
    select m.id, m.client_id into v_moto_id, v_customer_id
      from public.motorcycles m where m.plate = v_plate;

    if v_moto_id is null then
      if char_length(trim(coalesce(p_brand, ''))) < 2 or char_length(trim(coalesce(p_model, ''))) < 1
         or p_year is null then
        raise exception 'Completa marca, modelo y año de la moto' using errcode = '22023';
      end if;

      v_customer_id := p_customer_id;
      if v_customer_id is null and v_email is not null then
        select c.id into v_customer_id from public.customers c where lower(c.email) = v_email;
      end if;
      if v_customer_id is null then
        insert into public.customers (name, phone, email)
        values (trim(p_customer_name), trim(p_customer_phone), v_email)
        returning customers.id into v_customer_id;
      end if;

      insert into public.motorcycles (client_id, brand, model, year, plate)
      values (v_customer_id, trim(p_brand), trim(p_model), p_year, v_plate)
      returning motorcycles.id into v_moto_id;
    end if;
  end if;

  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.appointments a where a.booking_code = v_code);
  end loop;

  insert into public.appointments (
    client_id, motorcycle_id, service_type, scheduled_at, duration_minutes, status, notes,
    booking_code, source, contact_name, contact_phone, contact_email
  )
  values (
    v_customer_id, v_moto_id, p_service, p_start, v_minutes, 'scheduled', nullif(trim(p_notes), ''),
    v_code, case when v_staff then 'staff' else 'public' end,
    nullif(trim(p_customer_name), ''), nullif(trim(p_customer_phone), ''), v_email
  )
  returning appointments.id into v_id;

  return query select v_id, v_code, p_start, v_minutes;
end;
$$;

-- Reagendar (reactiva canceladas / ausentes).
create or replace function public.reschedule_appointment(p_id uuid, p_start timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('motoops.appointments'));

  select * into v_appt from public.appointments where id = p_id for update;
  if not found then
    raise exception 'Cita no encontrada' using errcode = 'P0002';
  end if;
  if v_appt.status = 'completed' then
    raise exception 'La cita ya se convirtió en orden de trabajo' using errcode = '22023';
  end if;

  perform public.assert_appointment_slot(p_start, v_appt.duration_minutes, p_id);

  update public.appointments
     set scheduled_at = p_start,
         status = case when status in ('cancelled', 'no_show') then 'scheduled' else status end
   where id = p_id;
end;
$$;

-- Convierte una cita en OT "Recepcionada" (idempotente: si ya existe, la devuelve).
create or replace function public.convert_appointment_to_work_order(
  p_appointment_id uuid,
  p_mechanic_id    uuid    default null,
  p_km             integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt   public.appointments;
  v_km     integer;
  v_wo_id  uuid;
  v_reason text;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'Cita no encontrada' using errcode = 'P0002';
  end if;

  select w.id into v_wo_id from public.work_orders w where w.appointment_id = p_appointment_id;
  if v_wo_id is not null then
    return v_wo_id;
  end if;

  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'Solo se pueden convertir citas agendadas o confirmadas' using errcode = '22023';
  end if;

  select current_km into v_km from public.motorcycles where id = v_appt.motorcycle_id;
  if p_km is not null then
    if p_km < v_km then
      raise exception 'El kilometraje es menor al último registrado (% km)', v_km using errcode = '22023';
    end if;
    v_km := p_km;
  end if;

  v_reason := 'Cita MO-' || coalesce(v_appt.booking_code, '—') || ' · '
    || case v_appt.service_type
         when 'maintenance' then 'Mantenimiento programado'
         when 'inspection'  then 'Inspección / revisión'
         else 'Diagnóstico por falla'
       end
    || coalesce(E'\n' || v_appt.notes, '');

  insert into public.work_orders (motorcycle_id, appointment_id, mechanic_id, intake_reason, km_at_intake)
  values (v_appt.motorcycle_id, p_appointment_id, p_mechanic_id, v_reason, v_km)
  returning id into v_wo_id;

  update public.appointments set status = 'completed' where id = p_appointment_id;
  return v_wo_id;
end;
$$;

revoke execute on function public.get_busy_slots(timestamptz, timestamptz) from public;
grant execute on function public.get_busy_slots(timestamptz, timestamptz) to anon, authenticated;
revoke execute on function public.book_appointment(public.service_type, timestamptz, text, text, text, text, text, text, smallint, text, uuid, uuid) from public;
grant execute on function public.book_appointment(public.service_type, timestamptz, text, text, text, text, text, text, smallint, text, uuid, uuid) to anon, authenticated;
revoke execute on function public.reschedule_appointment(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;
revoke execute on function public.convert_appointment_to_work_order(uuid, uuid, integer) from public, anon;
grant execute on function public.convert_appointment_to_work_order(uuid, uuid, integer) to authenticated;
revoke execute on function public.assert_appointment_slot(timestamptz, integer, uuid, interval) from public, anon, authenticated;

create or replace view public.v_appointments
with (security_invoker = true) as
select a.id,
       a.booking_code,
       a.service_type,
       a.scheduled_at,
       a.duration_minutes,
       a.status,
       a.notes,
       a.source,
       a.contact_name,
       a.contact_phone,
       a.contact_email,
       a.created_at,
       c.id     as customer_id,
       c.name   as customer_name,
       c.phone  as customer_phone,
       c.email  as customer_email,
       m.id     as motorcycle_id,
       m.brand,
       m.model,
       m.year,
       m.plate,
       m.current_km,
       w.id     as work_order_id,
       w.number as work_order_number
  from public.appointments a
  join public.customers c on c.id = a.client_id
  join public.motorcycles m on m.id = a.motorcycle_id
  left join public.work_orders w on w.appointment_id = a.id;

-- -----------------------------------------------------------------------------
-- 7.8 Ventas: punto de venta (mostrador) y tienda online
-- -----------------------------------------------------------------------------
-- Ambas funciones siguen el flujo de ventas del encabezado en UNA transacción:
-- venta 'pending' → líneas (precio del catálogo) → 'paid' (descuenta stock con
-- motivo pos_sale / online_sale). Si algo falla, no queda nada a medias.

-- p_items: [{"product_id": "<uuid>", "quantity": 2}, ...]
create or replace function public.assert_sale_items(p_items jsonb, p_max_quantity integer default 999)
returns void
language plpgsql
immutable
as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Demasiados productos en una sola venta (máx. 50)' using errcode = '22023';
  end if;
  if exists (
    select 1
      from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
     where i.product_id is null or i.quantity is null
        or i.quantity < 1 or i.quantity > p_max_quantity
  ) then
    raise exception 'Cantidad inválida (entre 1 y % unidades por producto)', p_max_quantity
      using errcode = '22023';
  end if;
end;
$$;

-- Inserta las líneas de una venta pendiente (agrupa productos repetidos).
create or replace function public.insert_sale_items(p_sale_id uuid, p_items jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.order_items (sale_id, product_id, quantity, unit_price)
  select p_sale_id, i.product_id, sum(i.quantity), 0  -- el trigger fija el precio
    from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
   group by i.product_id;
$$;

-- Venta de mostrador (staff). p_tax_rate: 0 = precios finales; 0.19 = +IVA.
create or replace function public.create_pos_sale(
  p_items           jsonb,
  p_payment_method  public.payment_method,
  p_customer_id     uuid    default null,
  p_tax_rate        numeric default 0,
  p_amount_tendered numeric default null,
  p_notes           text    default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers;
  v_sale     public.sales;
begin
  if not public.is_staff() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_payment_method not in ('cash', 'card', 'debit_card', 'credit_card', 'transfer') then
    raise exception 'Medio de pago no válido en mostrador' using errcode = '22023';
  end if;
  if p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 0.5 then
    raise exception 'Tasa de impuesto inválida' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 300 then
    raise exception 'Nota demasiado larga' using errcode = '22023';
  end if;
  perform public.assert_sale_items(p_items);

  if p_customer_id is not null then
    select * into v_customer from public.customers where id = p_customer_id;
    if not found then
      raise exception 'Cliente no encontrado' using errcode = 'P0002';
    end if;
  end if;

  insert into public.sales (
    channel, status, customer_id, payment_method, notes,
    contact_name, contact_email, contact_phone
  )
  values (
    'pos', 'pending', v_customer.id, p_payment_method, nullif(trim(p_notes), ''),
    v_customer.name, v_customer.email, v_customer.phone
  )
  returning * into v_sale;

  perform public.insert_sale_items(v_sale.id, p_items);
  select subtotal into v_sale.subtotal from public.sales where id = v_sale.id;

  update public.sales
     set tax             = round(v_sale.subtotal * p_tax_rate, 2),
         amount_tendered = case when p_payment_method = 'cash' then p_amount_tendered end,
         status          = 'paid'
   where id = v_sale.id
  returning * into v_sale;

  if p_payment_method = 'cash' and p_amount_tendered is not null and p_amount_tendered < v_sale.total then
    raise exception 'El efectivo recibido es menor al total' using errcode = '22023';
  end if;

  return v_sale;
end;
$$;

-- Compra online (pública, con o sin cuenta). El pago con tarjeta online se
-- confirma al instante (pasarela a integrar); transferencia y efectivo al
-- retirar quedan confirmados y el stock reservado desde ya.
create or replace function public.checkout_online(
  p_items            jsonb,
  p_payment_method   public.payment_method,
  p_fulfillment      text,
  p_customer_name    text,
  p_customer_email   text,
  p_customer_phone   text,
  p_shipping_address jsonb default null,
  p_notes            text  default null
)
returns table (id uuid, number bigint, folio text, subtotal numeric, total numeric, paid_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email       text := nullif(lower(trim(coalesce(p_customer_email, ''))), '');
  v_customer_id uuid;
  v_sale        public.sales;
begin
  perform public.assert_sale_items(p_items, 20);

  if char_length(trim(coalesce(p_customer_name, ''))) < 2 then
    raise exception 'Ingresa tu nombre' using errcode = '22023';
  end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido' using errcode = '22023';
  end if;
  if coalesce(p_customer_phone, '') !~ '^\+?[0-9\s\-()]{6,20}$' then
    raise exception 'Teléfono inválido' using errcode = '22023';
  end if;
  if p_fulfillment is null or p_fulfillment not in ('pickup', 'delivery') then
    raise exception 'Elige retiro en taller o envío' using errcode = '22023';
  end if;
  if p_payment_method not in ('online', 'transfer', 'cash') then
    raise exception 'Medio de pago no disponible' using errcode = '22023';
  end if;
  if p_payment_method = 'cash' and p_fulfillment <> 'pickup' then
    raise exception 'El pago en efectivo es solo para retiro en taller' using errcode = '22023';
  end if;
  if p_fulfillment = 'delivery' and (
       char_length(trim(coalesce(p_shipping_address ->> 'street', ''))) < 3
    or char_length(trim(coalesce(p_shipping_address ->> 'city', ''))) < 2
    or char_length(trim(coalesce(p_shipping_address ->> 'postal_code', ''))) < 3
  ) then
    raise exception 'Completa la dirección de envío' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 300 then
    raise exception 'Nota demasiado larga' using errcode = '22023';
  end if;

  -- Cliente del taller: se reutiliza por email o se crea.
  select c.id into v_customer_id from public.customers c where lower(c.email) = v_email;
  if v_customer_id is null then
    insert into public.customers (name, phone, email, profile_id)
    values (
      trim(p_customer_name), trim(p_customer_phone), v_email,
      (select pr.id from public.profiles pr
        where pr.id = auth.uid()
          and not exists (select 1 from public.customers x where x.profile_id = pr.id))
    )
    returning customers.id into v_customer_id;
  end if;

  insert into public.sales (
    channel, status, client_id, customer_id, payment_method, fulfillment,
    shipping_address, notes, contact_name, contact_email, contact_phone
  )
  values (
    'online', 'pending', auth.uid(), v_customer_id, p_payment_method, p_fulfillment,
    case when p_fulfillment = 'delivery' then p_shipping_address end,
    nullif(trim(p_notes), ''), trim(p_customer_name), v_email, trim(p_customer_phone)
  )
  returning * into v_sale;

  perform public.insert_sale_items(v_sale.id, p_items);

  update public.sales s set status = 'paid' where s.id = v_sale.id
  returning * into v_sale;

  return query
    select v_sale.id, v_sale.number, public.sale_folio(v_sale.number),
           v_sale.subtotal, v_sale.total, v_sale.paid_at;
end;
$$;

-- Unidades vendidas por producto (para "más vendidos"), sin datos personales.
create or replace function public.get_product_popularity(p_days integer default 90)
returns table (product_id uuid, units bigint)
language sql
stable
security definer
set search_path = public
as $$
  select oi.product_id, sum(oi.quantity)::bigint
    from public.order_items oi
    join public.sales s on s.id = oi.sale_id
   where s.status = 'paid'
     and s.channel in ('pos', 'online')
     and s.paid_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 365))
   group by oi.product_id;
$$;

revoke execute on function public.assert_sale_items(jsonb, integer) from public, anon, authenticated;
revoke execute on function public.insert_sale_items(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.create_pos_sale(jsonb, public.payment_method, uuid, numeric, numeric, text) from public, anon;
grant execute on function public.create_pos_sale(jsonb, public.payment_method, uuid, numeric, numeric, text) to authenticated;
revoke execute on function public.checkout_online(jsonb, public.payment_method, text, text, text, text, jsonb, text) from public;
grant execute on function public.checkout_online(jsonb, public.payment_method, text, text, text, text, jsonb, text) to anon, authenticated;
revoke execute on function public.get_product_popularity(integer) from public;
grant execute on function public.get_product_popularity(integer) to anon, authenticated;

-- Historial de ventas (respeta RLS: staff ve todo; un cliente, lo suyo).
create or replace view public.v_sales
with (security_invoker = true) as
select s.id,
       s.number,
       public.sale_folio(s.number) as folio,
       s.channel,
       s.status,
       s.payment_method,
       s.subtotal,
       s.discount,
       s.tax,
       s.total,
       s.amount_tendered,
       s.fulfillment,
       s.shipping_address,
       s.notes,
       s.paid_at,
       s.created_at,
       s.customer_id,
       coalesce(s.contact_name, c.name, p.name)    as customer_name,
       coalesce(s.contact_email, c.email, p.email) as customer_email,
       coalesce(s.contact_phone, c.phone, p.phone) as customer_phone,
       seller.name                                 as seller_name,
       coalesce((select sum(oi.quantity) from public.order_items oi where oi.sale_id = s.id), 0) as units
  from public.sales s
  left join public.customers c on c.id = s.customer_id
  left join public.profiles p on p.id = s.client_id
  left join public.profiles seller on seller.id = s.created_by
 where s.channel in ('pos', 'online');

-- Tiempo real: el dashboard (inventario / métricas) escucha ventas y stock.
do $$ begin
  alter publication supabase_realtime add table public.sales;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object or undefined_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 8. Vistas para el dashboard (respetan RLS del usuario que consulta)
-- -----------------------------------------------------------------------------
create or replace view public.v_low_stock_products
with (security_invoker = true) as
select id, name, sku, category, stock, min_stock,
       (min_stock - stock) as shortage
  from public.products
 where is_active and stock <= min_stock
 order by (stock::numeric / nullif(min_stock, 0)) nulls first, name;

create or replace view public.v_monthly_revenue
with (security_invoker = true) as
select date_trunc('month', paid_at)::date as month,
       channel,
       count(*)                           as sales_count,
       sum(total)                         as revenue
  from public.sales
 where status = 'paid'
 group by 1, 2;

-- -----------------------------------------------------------------------------
-- 9. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.motorcycles         enable row level security;
alter table public.products            enable row level security;
alter table public.appointments        enable row level security;
alter table public.work_orders         enable row level security;
alter table public.sales               enable row level security;
alter table public.order_items         enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.customers           enable row level security;
alter table public.work_order_parts    enable row level security;
alter table public.work_order_labor    enable row level security;
alter table public.work_order_photos   enable row level security;

-- customers
drop policy if exists "customers: client reads own" on public.customers;
create policy "customers: client reads own" on public.customers
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "customers: staff full access" on public.customers;
create policy "customers: staff full access" on public.customers
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- profiles
drop policy if exists "profiles: select own or staff" on public.profiles;
create policy "profiles: select own or staff" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles: update own or admin" on public.profiles;
create policy "profiles: update own or admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- motorcycles
drop policy if exists "motorcycles: client manages own" on public.motorcycles;
create policy "motorcycles: client manages own" on public.motorcycles
  for all to authenticated
  using (public.is_my_customer(client_id))
  with check (public.is_my_customer(client_id));

drop policy if exists "motorcycles: staff full access" on public.motorcycles;
create policy "motorcycles: staff full access" on public.motorcycles
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- products (catálogo público de solo lectura)
drop policy if exists "products: public read active" on public.products;
create policy "products: public read active" on public.products
  for select to anon, authenticated
  using (is_active or public.is_staff());

drop policy if exists "products: staff insert" on public.products;
create policy "products: staff insert" on public.products
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists "products: staff update" on public.products;
create policy "products: staff update" on public.products
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "products: admin delete" on public.products;
create policy "products: admin delete" on public.products
  for delete to authenticated
  using (public.is_admin());

-- appointments
drop policy if exists "appointments: client reads own" on public.appointments;
create policy "appointments: client reads own" on public.appointments
  for select to authenticated
  using (public.is_my_customer(client_id));

-- Las reservas (públicas o de clientes) pasan por book_appointment(), que
-- valida horario, anticipación y capacidad: no hay INSERT directo.
drop policy if exists "appointments: client books pending" on public.appointments;

drop policy if exists "appointments: staff full access" on public.appointments;
create policy "appointments: staff full access" on public.appointments
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- work_orders
drop policy if exists "work_orders: client reads own motorcycles" on public.work_orders;
create policy "work_orders: client reads own motorcycles" on public.work_orders
  for select to authenticated
  using (exists (
    select 1 from public.motorcycles m
     where m.id = work_orders.motorcycle_id and public.is_my_customer(m.client_id)
  ));

drop policy if exists "work_orders: staff full access" on public.work_orders;
create policy "work_orders: staff full access" on public.work_orders
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- work_order_parts: lectura por RLS de la OT; escritura SOLO vía
-- add_work_order_part() / remove_work_order_part() (mueven stock).
drop policy if exists "work_order_parts: read with order" on public.work_order_parts;
create policy "work_order_parts: read with order" on public.work_order_parts
  for select to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_parts.work_order_id));

-- work_order_labor
drop policy if exists "work_order_labor: read with order" on public.work_order_labor;
create policy "work_order_labor: read with order" on public.work_order_labor
  for select to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_labor.work_order_id));

drop policy if exists "work_order_labor: staff writes" on public.work_order_labor;
create policy "work_order_labor: staff writes" on public.work_order_labor
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- work_order_photos: el cliente ve las fotos de sus motos; el staff gestiona.
drop policy if exists "work_order_photos: client reads own" on public.work_order_photos;
create policy "work_order_photos: client reads own" on public.work_order_photos
  for select to authenticated
  using (exists (
    select 1
      from public.work_orders w
      join public.motorcycles m on m.id = w.motorcycle_id
     where w.id = work_order_photos.work_order_id
       and public.is_my_customer(m.client_id)
  ));

drop policy if exists "work_order_photos: staff full access" on public.work_order_photos;
create policy "work_order_photos: staff full access" on public.work_order_photos
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- sales
drop policy if exists "sales: client reads own" on public.sales;
create policy "sales: client reads own" on public.sales
  for select to authenticated
  using (client_id = auth.uid());

drop policy if exists "sales: client creates online pending" on public.sales;
create policy "sales: client creates online pending" on public.sales
  for insert to authenticated
  with check (
    client_id = auth.uid()
    and channel = 'online'
    and status = 'pending'
    and discount = 0
    and tax = 0
  );

drop policy if exists "sales: staff full access" on public.sales;
create policy "sales: staff full access" on public.sales
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- order_items
drop policy if exists "order_items: client reads own" on public.order_items;
create policy "order_items: client reads own" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.sales s
     where s.id = order_items.sale_id and s.client_id = auth.uid()
  ));

drop policy if exists "order_items: client edits own pending cart" on public.order_items;
create policy "order_items: client edits own pending cart" on public.order_items
  for all to authenticated
  using (exists (
    select 1 from public.sales s
     where s.id = order_items.sale_id
       and s.client_id = auth.uid()
       and s.status = 'pending'
  ))
  with check (exists (
    select 1 from public.sales s
     where s.id = order_items.sale_id
       and s.client_id = auth.uid()
       and s.status = 'pending'
  ));

drop policy if exists "order_items: staff full access" on public.order_items;
create policy "order_items: staff full access" on public.order_items
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- inventory_movements (las salidas por venta las inserta el trigger)
drop policy if exists "inventory_movements: staff read" on public.inventory_movements;
create policy "inventory_movements: staff read" on public.inventory_movements
  for select to authenticated
  using (public.is_staff());

-- Sin política de INSERT: los movimientos solo se crean desde triggers y la
-- función adjust_stock(), así el historial siempre coincide con el stock.
drop policy if exists "inventory_movements: staff manual entries" on public.inventory_movements;

-- -----------------------------------------------------------------------------
-- 10. Storage: imágenes de productos
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

drop policy if exists "product-images: public read" on storage.objects;
create policy "product-images: public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "product-images: staff write" on storage.objects;
create policy "product-images: staff write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());

drop policy if exists "product-images: staff update" on storage.objects;
create policy "product-images: staff update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_staff());

drop policy if exists "product-images: staff delete" on storage.objects;
create policy "product-images: staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_staff());

-- -----------------------------------------------------------------------------
-- 11. Storage: evidencia fotográfica de OTs (bucket privado)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-order-photos', 'work-order-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

drop policy if exists "work-order-photos: staff read" on storage.objects;
create policy "work-order-photos: staff read" on storage.objects
  for select to authenticated
  using (bucket_id = 'work-order-photos' and public.is_staff());

drop policy if exists "work-order-photos: staff write" on storage.objects;
create policy "work-order-photos: staff write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'work-order-photos' and public.is_staff());

drop policy if exists "work-order-photos: staff delete" on storage.objects;
create policy "work-order-photos: staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'work-order-photos' and public.is_staff());

-- -----------------------------------------------------------------------------
-- 12. Alta de OT solo por recepción con fotos
-- -----------------------------------------------------------------------------
-- create_work_order() y convert_appointment_to_work_order() quedan como
-- funciones internas de check_in_work_order() (que corre como owner).
revoke execute on function public.create_work_order(text, integer, uuid, uuid, uuid, text, text, text, text, text, smallint, text, text) from authenticated;
revoke execute on function public.convert_appointment_to_work_order(uuid, uuid, integer) from authenticated;

-- =============================================================================
-- 13. Talleres (tenants), onboarding y superadministración
-- -----------------------------------------------------------------------------
-- Capa de talleres: cada perfil de staff pertenece a un taller, que guarda sus
-- datos comerciales, tarifas y el estado del onboarding. Los datos operativos
-- (OTs, ventas, inventario, clientes…) aún NO llevan workshop_id: todos
-- pertenecen al taller principal. El aislamiento por taller es una etapa aparte.
--
-- IMPORTANTE: 'superadmin' se agrega al enum en este mismo script, así que no
-- se usa como literal del tipo user_role (se compara como texto).
-- =============================================================================
alter type public.user_role add value if not exists 'superadmin';

create table if not exists public.workshops (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  rut                  text,
  address              text,
  city                 text,
  phone                text,
  email                text,
  specialty            text,
  logo_url             text,           -- data URL comprimida en el navegador
  hourly_rate          integer not null default 45000,
  tax_rate             numeric(4, 3) not null default 0.19,
  reception_policy     text,
  onboarding_completed boolean not null default false,
  onboarded_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint workshops_name_length check (char_length(trim(name)) between 2 and 120),
  constraint workshops_rut_valid check (rut is null or public.rut_is_valid(rut)),
  constraint workshops_phone_format check (phone is null or phone ~ '^\+?[0-9\s\-()]{6,20}$'),
  constraint workshops_hourly_rate_range check (hourly_rate between 1000 and 1000000),
  constraint workshops_tax_rate_range check (tax_rate between 0 and 0.5),
  constraint workshops_logo_size check (logo_url is null or (logo_url like 'data:image/%' and char_length(logo_url) <= 400000)),
  constraint workshops_policy_length check (reception_policy is null or char_length(reception_policy) <= 2000)
);

drop trigger if exists workshops_updated_at on public.workshops;
create trigger workshops_updated_at
  before update on public.workshops
  for each row execute function public.set_updated_at();

-- Taller principal: dueño de los datos existentes (mismo id que PRIMARY_WORKSHOP_ID).
insert into public.workshops (id, name)
values ('00000000-0000-0000-0000-000000000001', 'MotoOps Taller')
on conflict (id) do nothing;

alter table public.profiles
  add column if not exists workshop_id uuid references public.workshops (id) on delete set null;
create index if not exists profiles_workshop_idx on public.profiles (workshop_id);

-- El staff existente queda en el taller principal (su admin verá el onboarding).
update public.profiles
   set workshop_id = '00000000-0000-0000-0000-000000000001'
 where workshop_id is null
   and role in ('admin', 'mechanic');

-- Equipo cargado en el onboarding. Con email funciona como invitación: al
-- registrarse (handle_new_user) o si ya tenía cuenta, recibe el rol de staff.
create table if not exists public.workshop_staff (
  id           uuid primary key default gen_random_uuid(),
  workshop_id  uuid not null references public.workshops (id) on delete cascade,
  name         text not null,
  email        text,
  phone        text,
  role         public.user_role not null default 'mechanic',
  specialty    text,
  profile_id   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint workshop_staff_role_valid check (role in ('admin', 'mechanic')),
  constraint workshop_staff_name_length check (char_length(trim(name)) between 2 and 120),
  constraint workshop_staff_email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint workshop_staff_phone_format check (phone is null or phone ~ '^\+?[0-9\s\-()]{6,20}$')
);

create unique index if not exists workshop_staff_email_unique
  on public.workshop_staff (workshop_id, lower(email))
  where email is not null;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_role()::text = 'superadmin', false);
$$;

create or replace function public.my_workshop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workshop_id from public.profiles where id = auth.uid();
$$;

-- Onboarding atómico: datos del taller + equipo, y marca onboarding_completed.
-- Toma el taller del perfil (no se puede configurar uno ajeno).
create or replace function public.complete_workshop_onboarding(p_workshop jsonb, p_staff jsonb default '[]')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workshop uuid := public.my_workshop_id();
begin
  if not public.is_admin() or v_workshop is null then
    raise exception 'Solo el administrador del taller puede configurarlo' using errcode = '42501';
  end if;

  update public.workshops
     set name                 = trim(p_workshop ->> 'name'),
         rut                  = nullif(trim(p_workshop ->> 'rut'), ''),
         address              = nullif(trim(p_workshop ->> 'address'), ''),
         city                 = nullif(trim(p_workshop ->> 'city'), ''),
         phone                = nullif(trim(p_workshop ->> 'phone'), ''),
         email                = nullif(lower(trim(p_workshop ->> 'email')), ''),
         specialty            = nullif(trim(p_workshop ->> 'specialty'), ''),
         logo_url             = nullif(p_workshop ->> 'logo_url', ''),
         hourly_rate          = (p_workshop ->> 'hourly_rate')::integer,
         tax_rate             = (p_workshop ->> 'tax_rate')::numeric,
         reception_policy     = nullif(trim(p_workshop ->> 'reception_policy'), ''),
         onboarding_completed = true,
         onboarded_at         = now()
   where id = v_workshop;

  insert into public.workshop_staff (workshop_id, name, email, phone, role, specialty)
  select v_workshop,
         trim(s ->> 'name'),
         nullif(lower(trim(s ->> 'email')), ''),
         nullif(trim(s ->> 'phone'), ''),
         (case when s ->> 'role' = 'admin' then 'admin' else 'mechanic' end)::public.user_role,
         nullif(trim(s ->> 'specialty'), '')
    from jsonb_array_elements(coalesce(p_staff, '[]'::jsonb)) as s
  on conflict do nothing;

  -- Quienes ya tenían cuenta de cliente con ese email pasan a ser staff del taller.
  update public.profiles p
     set role = ws.role, workshop_id = v_workshop
    from public.workshop_staff ws
   where ws.workshop_id = v_workshop
     and ws.profile_id is null
     and ws.email is not null
     and lower(p.email) = lower(ws.email)
     and p.role = 'client';

  update public.workshop_staff ws
     set profile_id = p.id
    from public.profiles p
   where ws.workshop_id = v_workshop
     and ws.profile_id is null
     and ws.email is not null
     and lower(p.email) = lower(ws.email)
     and p.workshop_id = v_workshop;
end;
$$;

-- Directorio de talleres (superadmin): con cuentas de staff y equipo registrado.
create or replace function public.admin_list_workshops()
returns table (
  id uuid, name text, rut text, city text, phone text, email text, specialty text, logo_url text,
  onboarding_completed boolean, created_at timestamptz, users bigint, staff bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.name, w.rut, w.city, w.phone, w.email, w.specialty, w.logo_url,
         w.onboarding_completed, w.created_at,
         (select count(*) from public.profiles p where p.workshop_id = w.id and p.role in ('admin', 'mechanic')),
         (select count(*) from public.workshop_staff s where s.workshop_id = w.id)
    from public.workshops w
   where public.is_superadmin()
   order by w.created_at desc;
$$;

-- Métricas consolidadas de la plataforma (superadmin).
create or replace function public.admin_global_metrics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_superadmin() then jsonb_build_object(
    'workshops',        (select count(*) from public.workshops),
    'onboarded',        (select count(*) from public.workshops where onboarding_completed),
    'staff_users',      (select count(*) from public.profiles where role in ('admin', 'mechanic') and workshop_id is not null),
    'work_orders',      (select count(*) from public.work_orders),
    'open_work_orders', (select count(*) from public.work_orders where status not in ('delivered', 'cancelled')),
    'sales_total',      (select coalesce(sum(total), 0) from public.sales where status = 'paid'),
    'sales_count',      (select count(*) from public.sales where status = 'paid')
  ) end;
$$;

grant execute on function public.complete_workshop_onboarding(jsonb, jsonb) to authenticated;
grant execute on function public.admin_list_workshops() to authenticated;
grant execute on function public.admin_global_metrics() to authenticated;

alter table public.workshops      enable row level security;
alter table public.workshop_staff enable row level security;

drop policy if exists "workshops: members read own, superadmin all" on public.workshops;
create policy "workshops: members read own, superadmin all" on public.workshops
  for select to authenticated
  using (public.is_superadmin() or id = public.my_workshop_id());

drop policy if exists "workshops: admin updates own" on public.workshops;
create policy "workshops: admin updates own" on public.workshops
  for update to authenticated
  using (public.is_admin() and id = public.my_workshop_id())
  with check (public.is_admin() and id = public.my_workshop_id());

drop policy if exists "workshops: superadmin creates" on public.workshops;
create policy "workshops: superadmin creates" on public.workshops
  for insert to authenticated
  with check (public.is_superadmin());

drop policy if exists "workshop_staff: read own workshop" on public.workshop_staff;
create policy "workshop_staff: read own workshop" on public.workshop_staff
  for select to authenticated
  using (public.is_superadmin() or (public.is_staff() and workshop_id = public.my_workshop_id()));

drop policy if exists "workshop_staff: admin manages own" on public.workshop_staff;
create policy "workshop_staff: admin manages own" on public.workshop_staff
  for all to authenticated
  using (public.is_admin() and workshop_id = public.my_workshop_id())
  with check (public.is_admin() and workshop_id = public.my_workshop_id());

-- Modo soporte: el superadmin LEE todo, pero no tiene políticas de escritura
-- (is_staff() es falso para él), así que el panel queda en solo lectura.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'customers', 'motorcycles', 'products', 'appointments', 'work_orders',
    'work_order_parts', 'work_order_labor', 'work_order_photos', 'sales', 'order_items',
    'inventory_movements'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || ': superadmin read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_superadmin())',
      t || ': superadmin read', t
    );
  end loop;
end $$;

drop policy if exists "work-order-photos: superadmin read" on storage.objects;
create policy "work-order-photos: superadmin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'work-order-photos' and public.is_superadmin());
