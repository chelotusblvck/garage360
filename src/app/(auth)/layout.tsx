import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <Link href="/" className="w-fit">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <aside className="relative hidden flex-col justify-end overflow-hidden bg-zinc-950 p-10 text-zinc-50 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40 [background:radial-gradient(60%_50%_at_70%_20%,var(--brand)_0%,transparent_70%)]"
        />
        <blockquote className="relative max-w-md space-y-3">
          <p className="text-2xl leading-snug font-medium">
            Inventario, órdenes de trabajo, agenda y tienda online en un solo lugar.
          </p>
          <footer className="text-sm text-zinc-400">
            MotoOps · Gestión integral para talleres de motos
          </footer>
        </blockquote>
      </aside>
    </div>
  );
}
