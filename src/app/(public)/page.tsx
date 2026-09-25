import Link from "next/link";
import { CalendarClock, Package, Wrench } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Package,
    title: "Repuestos originales",
    text: "Stock actualizado en tiempo real desde el taller.",
  },
  {
    icon: CalendarClock,
    title: "Agenda online",
    text: "Reserva mantenimientos y revisiones en segundos.",
  },
  {
    icon: Wrench,
    title: "Seguimiento del trabajo",
    text: "Consulta el estado de la orden de tu moto.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-20 md:py-28">
        <div className="grid max-w-2xl gap-5">
          <span className="w-fit rounded-full border px-3 py-1 text-xs text-muted-foreground">
            Taller y tienda de motos
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Tu moto en manos expertas, tus repuestos a un clic.
          </h1>
          <p className="text-lg text-pretty text-muted-foreground">
            Compra repuestos y accesorios online, agenda el service de tu moto y sigue cada
            trabajo desde tu cuenta.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/shop" className={buttonVariants({ size: "lg" })}>
              Ver tienda
            </Link>
            <Link href="/booking" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Agendar servicio
            </Link>
          </div>
        </div>
      </section>
      <section className="border-t bg-muted/40">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-14 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="grid gap-2">
              <f.icon className="size-5 text-brand" aria-hidden />
              <h2 className="font-medium">{f.title}</h2>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
