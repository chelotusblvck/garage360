import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenido de nuevo</h1>
        <p className="text-sm text-muted-foreground">
          Ingresa para gestionar tu taller o seguir tus pedidos.
        </p>
      </div>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
