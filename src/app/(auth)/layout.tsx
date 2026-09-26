import Link from "next/link";
import { CalendarClock, ClipboardCheck, Gauge, ScanBarcode } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";

const HIGHLIGHTS = [
  { icon: ClipboardCheck, text: "Recepción con fotos, órdenes de trabajo y comprobantes" },
  { icon: CalendarClock, text: "Agenda de mantenimientos y reservas online" },
  { icon: ScanBarcode, text: "Inventario, punto de venta y tienda en un solo stock" },
  { icon: Gauge, text: "Métricas del taller en tiempo real" },
];

/**
 * Split: formulario a la izquierda y banner a la derecha (lg+). Una pantalla
 * con [data-wide] (catálogo y cotización de /login) usa el ancho completo: la
 * columna del banner se anima de 1.1fr a 0fr (misma cantidad de columnas, así
 * grid-template-columns interpola) mientras el banner se desvanece y se
 * desplaza; al terminar, visibility lo saca del foco y de los lectores de
 * pantalla. Con prefers-reduced-motion el cambio es inmediato.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="group/auth grid min-h-svh overflow-x-clip ease-in-out motion-safe:transition-[grid-template-columns] motion-safe:duration-300 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:has-[[data-wide]]:grid-cols-[minmax(0,1fr)_minmax(0,0fr)]!">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <Link href="/inicio" className="w-fit" aria-label="MotoOps · inicio">
          <Wordmark size="lg" />
        </Link>
        <div className="flex flex-1 items-center justify-center py-6 group-has-[[data-wide]]/auth:items-start! md:group-has-[[data-wide]]/auth:py-8!">
          <div className="w-full max-w-sm ease-in-out motion-safe:transition-[max-width] motion-safe:duration-300 group-has-[[data-wide]]/auth:max-w-6xl!">
            {children}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} MotoOps · una plataforma <span className="font-medium text-foreground">Garage360</span>
        </p>
      </div>

      <aside
        className={
          "relative hidden overflow-hidden bg-zinc-950 p-10 text-zinc-50 lg:flex lg:min-w-md lg:flex-col " +
          // Visible ↔ salida (data-wide). min-w-md: al cerrarse la columna el banner no se reacomoda, se desliza fuera.
          "translate-x-0 scale-100 opacity-100 ease-in-out motion-safe:transition-all motion-safe:duration-300 " +
          "group-has-[[data-wide]]/auth:pointer-events-none group-has-[[data-wide]]/auth:invisible group-has-[[data-wide]]/auth:translate-x-8 group-has-[[data-wide]]/auth:scale-95 group-has-[[data-wide]]/auth:opacity-0"
        }
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-50 [background:radial-gradient(55%_45%_at_75%_15%,var(--brand)_0%,transparent_70%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(70%_60%_at_60%_40%,black,transparent)]"
        />

        <Wordmark size="lg" tagline className="relative" />

        <div className="relative mt-auto grid max-w-md gap-8">
          <p className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            La gestión integral de tu taller de motos, del ingreso a la entrega.
          </p>
          <ul className="grid gap-3.5 text-sm text-zinc-300">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/8 ring-1 ring-white/10">
                  <Icon className="size-4 text-zinc-100" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
