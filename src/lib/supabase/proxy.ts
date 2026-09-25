import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import { DEMO_SESSION_COOKIE } from "@/lib/session-cookies";

const PROTECTED_PREFIXES = ["/dashboard", "/print", "/onboarding", "/admin"];
const AUTH_ROUTES = ["/login", "/register"];

/**
 * Redirecciones optimistas según haya sesión o no. La autorización real (rol,
 * onboarding, modo soporte) se valida en los layouts, en las Server Actions y
 * en las políticas RLS de la base de datos.
 */
function guard(request: NextRequest, isAuthenticated: boolean, response: NextResponse) {
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && AUTH_ROUTES.includes(pathname)) {
    // La raíz deriva a cada rol a su pantalla de inicio.
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

/** Refresca la sesión de Supabase en cada request y aplica las redirecciones. */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  // Modo demo: la "sesión" es la cookie con el email de la cuenta demo.
  if (!env) {
    return guard(request, request.cookies.has(DEMO_SESSION_COOKIE), NextResponse.next({ request }));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value)
        );
      },
    },
  });

  // IMPORTANTE: no ejecutar lógica entre createServerClient y getClaims().
  const { data } = await supabase.auth.getClaims();
  return guard(request, Boolean(data?.claims), response);
}
