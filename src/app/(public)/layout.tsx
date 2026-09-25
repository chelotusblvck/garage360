import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CartButton, CartDrawerProvider } from "@/components/shop/cart-drawer";
import { buttonVariants } from "@/components/ui/button";

const NAV = [
  { href: "/shop", label: "Tienda" },
  { href: "/booking", label: "Agendar servicio" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartDrawerProvider>
      <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur print:hidden">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
            <Link href="/inicio">
              <Logo />
            </Link>
            <nav className="hidden items-center gap-5 text-sm sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/shop" className={buttonVariants({ variant: "ghost", className: "sm:hidden" })}>
                Tienda
              </Link>
              <CartButton />
              <Link href="/login" className={buttonVariants({ variant: "outline" })}>
                Ingresar
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t print:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground">
            <span>© {new Date().getFullYear()} MotoOps</span>
            <Link href="/dashboard" className="hover:text-foreground">
              Acceso taller
            </Link>
          </div>
        </footer>
      </div>
    </CartDrawerProvider>
  );
}
