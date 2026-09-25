"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRightLeft,
  Banknote,
  CircleCheck,
  CreditCard,
  Info,
  LoaderCircle,
  ShoppingBag,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { processEcommerceOrder } from "@/app/actions/ecommerce";
import { Field, fieldAria } from "@/components/forms/field";
import { broadcastSalesChange } from "@/components/live-refresh";
import { ProductThumb } from "@/components/inventory/product-thumb";
import { QuantityStepper } from "@/components/quantity-stepper";
import { cart, resolveCart, useCart } from "@/components/shop/cart-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SHOP } from "@/lib/business";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { CatalogProduct } from "@/lib/sales/catalog";
import { FULFILLMENT_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/sales/shared";
import type { OnlineOrderReceipt } from "@/lib/sales/types";
import { cn } from "@/lib/utils";
import {
  checkoutFormSchema,
  type CheckoutFormInput,
  type CheckoutFormValues,
  type Fulfillment,
  type OnlinePaymentMethod,
} from "@/lib/validations/schemas";

type ShopConfig = typeof SHOP;

const DEFAULTS: CheckoutFormValues = {
  customer: { name: "", email: "", phone: "", website: "" },
  shipping: { fulfillment: "pickup", street: "", city: "", postal_code: "", notes: "" },
  payment_method: "online",
};

const PAYMENT_OPTIONS: { value: OnlinePaymentMethod; title: string; hint: string; icon: LucideIcon }[] = [
  { value: "online", title: "Tarjeta de crédito o débito", hint: "Aprobación inmediata", icon: CreditCard },
  { value: "transfer", title: "Transferencia bancaria", hint: "Te mostramos los datos al confirmar", icon: ArrowRightLeft },
  { value: "cash", title: "Efectivo al retirar", hint: "Solo con retiro en el taller", icon: Banknote },
];

export function CheckoutView({ products, shop }: { products: CatalogProduct[]; shop: ShopConfig }) {
  const { lines: stored } = useCart();
  const [receipt, setReceipt] = useState<OnlineOrderReceipt | null>(null);

  // El carrito del navegador se valida contra precios y stock vigentes.
  const { lines, notes } = useMemo(
    () => resolveCart(stored, products, shop.maxUnitsPerProduct),
    [stored, products, shop.maxUnitsPerProduct]
  );
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  if (receipt) return <OrderConfirmed receipt={receipt} shop={shop} />;

  if (lines.length === 0) {
    return (
      <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-12 text-center">
        <ShoppingBag className="size-10 text-muted-foreground/60" aria-hidden />
        <h1 className="text-lg font-semibold">Tu carrito está vacío</h1>
        {notes.length ? <p className="text-sm text-muted-foreground">{notes.join(" ")}</p> : null}
        <Link href="/shop" className={buttonVariants()}>
          Ir a la tienda
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-1">
        <Link href="/shop" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Seguir comprando
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Finalizar compra</h1>
      </div>
      <CheckoutForm
        lines={lines}
        notes={notes}
        subtotal={subtotal}
        shop={shop}
        onConfirmed={(result) => {
          cart.clear();
          setReceipt(result);
          window.scrollTo({ top: 0 });
        }}
      />
    </>
  );
}

function CheckoutForm({
  lines,
  notes,
  subtotal,
  shop,
  onConfirmed,
}: {
  lines: ReturnType<typeof resolveCart>["lines"];
  notes: string[];
  subtotal: number;
  shop: ShopConfig;
  onConfirmed: (receipt: OnlineOrderReceipt) => void;
}) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name.replace(".", "-")}`;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<CheckoutFormValues, unknown, CheckoutFormInput>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: DEFAULTS,
    mode: "onTouched",
  });
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const [fulfillment, paymentMethod] = useWatch({ control, name: ["shipping.fulfillment", "payment_method"] });

  function chooseFulfillment(next: Fulfillment) {
    setValue("shipping.fulfillment", next, { shouldValidate: form.formState.isSubmitted });
    if (next === "delivery" && paymentMethod === "cash") setValue("payment_method", "online");
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const result = await processEcommerceOrder(
      lines.map((l) => ({ product_id: l.id, quantity: l.quantity })),
      values.customer,
      values.shipping,
      values.payment_method
    );
    if (!result.ok) {
      for (const [path, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0] && path !== "items") setError(path as Path<CheckoutFormValues>, { message: messages[0] });
      }
      setSubmitError(result.error);
      toast.error(result.error);
      return;
    }
    broadcastSalesChange();
    toast.success(`Pedido ${result.data.folio} confirmado`);
    onConfirmed(result.data);
  });

  const err = errors.customer;
  const shipErr = errors.shipping;

  return (
    <form onSubmit={onSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-6">
        {/* Contacto */}
        <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-labelledby={id("contact")}>
          <h2 id={id("contact")} className="font-medium">
            1. Datos de contacto
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre y apellido" htmlFor={id("customer.name")} error={err?.name?.message} className="sm:col-span-2">
              <Input autoComplete="name" {...fieldAria(id("customer.name"), err?.name?.message)} {...register("customer.name")} />
            </Field>
            <Field label="Email" htmlFor={id("customer.email")} error={err?.email?.message} hint="Te enviamos la confirmación">
              <Input
                type="email"
                autoComplete="email"
                {...fieldAria(id("customer.email"), err?.email?.message, true)}
                {...register("customer.email")}
              />
            </Field>
            <Field label="Teléfono / WhatsApp" htmlFor={id("customer.phone")} error={err?.phone?.message}>
              <Input
                type="tel"
                autoComplete="tel"
                placeholder="+56 9 1234 5678"
                {...fieldAria(id("customer.phone"), err?.phone?.message)}
                {...register("customer.phone")}
              />
            </Field>
          </div>
          {/* Honeypot anti-bots: invisible para personas. */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" {...register("customer.website")} />
        </section>

        {/* Entrega */}
        <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-labelledby={id("delivery")}>
          <h2 id={id("delivery")} className="font-medium">
            2. Entrega
          </h2>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby={id("delivery")}>
            <OptionCard
              active={fulfillment === "pickup"}
              onSelect={() => chooseFulfillment("pickup")}
              icon={Store}
              title="Retiro en el taller"
              hint={`Sin cargo · ${shop.pickupHours}`}
            />
            <OptionCard
              active={fulfillment === "delivery"}
              onSelect={() => chooseFulfillment("delivery")}
              icon={Truck}
              title="Envío a domicilio"
              hint="Costo a coordinar según la zona"
            />
          </div>

          {fulfillment === "pickup" ? (
            <p className="text-sm text-muted-foreground">
              Retiras en <span className="text-foreground">{shop.pickupAddress}</span>. Te avisamos cuando esté listo.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Calle y número" htmlFor={id("shipping.street")} error={shipErr?.street?.message} className="sm:col-span-6">
                <Input
                  autoComplete="street-address"
                  {...fieldAria(id("shipping.street"), shipErr?.street?.message)}
                  {...register("shipping.street")}
                />
              </Field>
              <Field label="Comuna" htmlFor={id("shipping.city")} error={shipErr?.city?.message} className="sm:col-span-4">
                <Input
                  autoComplete="address-level2"
                  {...fieldAria(id("shipping.city"), shipErr?.city?.message)}
                  {...register("shipping.city")}
                />
              </Field>
              <Field label="Código postal" htmlFor={id("shipping.postal_code")} error={shipErr?.postal_code?.message} className="sm:col-span-2">
                <Input
                  autoComplete="postal-code"
                  {...fieldAria(id("shipping.postal_code"), shipErr?.postal_code?.message)}
                  {...register("shipping.postal_code")}
                />
              </Field>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground sm:col-span-6">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {shop.deliveryNote}
              </p>
            </div>
          )}

          <Field
            label="Notas del pedido (opcional)"
            htmlFor={id("shipping.notes")}
            error={shipErr?.notes?.message}
            hint="Horario de entrega, modelo de moto para confirmar compatibilidad, etc."
          >
            <Textarea rows={2} {...fieldAria(id("shipping.notes"), shipErr?.notes?.message, true)} {...register("shipping.notes")} />
          </Field>
        </section>

        {/* Pago */}
        <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-labelledby={id("payment")}>
          <h2 id={id("payment")} className="font-medium">
            3. Pago
          </h2>
          <div className="grid gap-2" role="radiogroup" aria-labelledby={id("payment")}>
            {PAYMENT_OPTIONS.map((option) => {
              const disabled = option.value === "cash" && fulfillment === "delivery";
              return (
                <OptionCard
                  key={option.value}
                  active={paymentMethod === option.value}
                  disabled={disabled}
                  onSelect={() => setValue("payment_method", option.value, { shouldValidate: true })}
                  icon={option.icon}
                  title={option.title}
                  hint={option.hint}
                />
              );
            })}
          </div>
          {errors.payment_method?.message ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.payment_method.message}
            </p>
          ) : null}
        </section>
      </div>

      {/* Resumen */}
      <aside className="grid gap-0 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 lg:sticky lg:top-20" aria-label="Resumen del pedido">
        <h2 className="border-b p-4 font-medium">Resumen del pedido</h2>
        {notes.length ? (
          <ul className="grid gap-1 border-b bg-status-warning/10 p-3 text-xs">
            {notes.map((note) => (
              <li key={note} className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3.5 shrink-0 text-status-serious" aria-hidden />
                {note}
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="max-h-80 divide-y overflow-y-auto">
          {lines.map((line) => (
            <li key={line.id} className="flex gap-3 p-3">
              <ProductThumb src={line.image_url} alt="" />
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="line-clamp-2 text-sm leading-snug">{line.name}</p>
                <div className="flex items-center justify-between gap-2">
                  <QuantityStepper
                    size="sm"
                    value={line.quantity}
                    max={Math.min(line.stock, shop.maxUnitsPerProduct)}
                    label={line.name}
                    onChange={(q) => cart.setQuantity(line.id, q, shop.maxUnitsPerProduct)}
                  />
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(line.price * line.quantity)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <dl className="grid gap-1 border-t p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Envío</dt>
            <dd>{fulfillment === "pickup" ? "Sin cargo" : "A coordinar"}</dd>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t pt-2">
            <dt className="font-medium">Total</dt>
            <dd className="text-2xl font-semibold tracking-tight tabular-nums">{formatCurrency(subtotal)}</dd>
          </div>
        </dl>
        <div className="grid gap-2 border-t bg-muted/30 p-4">
          {submitError ? (
            <p role="alert" className="rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive">
              {submitError}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="h-11 text-base" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
            Confirmar pedido
          </Button>
          <p className="text-center text-xs text-muted-foreground">Precios finales con impuestos incluidos.</p>
        </div>
      </aside>
    </form>
  );
}

function OptionCard({
  active,
  disabled,
  onSelect,
  icon: Icon,
  title,
  hint,
}: {
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        active ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
      )}
    >
      <Icon className={cn("size-5 shrink-0", active ? "text-foreground" : "text-muted-foreground")} aria-hidden />
      <span className="grid">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function OrderConfirmed({ receipt, shop }: { receipt: OnlineOrderReceipt; shop: ShopConfig }) {
  const nextSteps: Record<OnlinePaymentMethod, string> = {
    online: "El pago fue aprobado.",
    transfer: `Transfiere ${formatCurrency(receipt.total)} a ${shop.transferAccount} e indica el número de pedido en el comentario.`,
    cash: `Abonas ${formatCurrency(receipt.total)} en efectivo al retirar.`,
  };

  return (
    <div className="mx-auto grid w-full max-w-xl justify-items-center gap-4 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
      <CircleCheck className="size-12 text-status-good" aria-hidden />
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">¡Pedido confirmado!</h1>
        <p className="text-muted-foreground">
          Número de pedido <span className="font-mono font-semibold text-foreground">{receipt.folio}</span>
        </p>
      </div>
      <dl className="grid w-full gap-1.5 rounded-lg bg-muted/50 p-4 text-left text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(receipt.total)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Pago</dt>
          <dd>{PAYMENT_METHOD_LABEL[receipt.payment_method]}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Entrega</dt>
          <dd>{FULFILLMENT_LABEL[receipt.fulfillment]}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Fecha</dt>
          <dd>{formatDateTime(new Date(receipt.paid_at))}</dd>
        </div>
      </dl>
      <p className="text-sm text-pretty">
        {nextSteps[receipt.payment_method]}{" "}
        {receipt.fulfillment === "pickup"
          ? `Te avisamos cuando esté listo para retirar en ${shop.pickupAddress}.`
          : "Te contactamos por WhatsApp para coordinar el envío."}
      </p>
      <p className="text-xs text-muted-foreground">
        Guarda el número de pedido. Ante cualquier novedad te escribimos a {receipt.email}.
      </p>
      <Link href="/shop" className={buttonVariants({ variant: "outline" })}>
        Seguir comprando
      </Link>
    </div>
  );
}
