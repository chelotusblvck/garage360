/*
 * Cookies de sesión propias de la app (las de Supabase las maneja @supabase/ssr).
 * Sin "server-only": las lee también el proxy.
 */

/** Modo demo: email de la cuenta demo con la que se ingresó. */
export const DEMO_SESSION_COOKIE = "motoops_demo_session";

/** Modo soporte del superadmin: id del taller al que ingresó (solo lectura). */
export const SUPPORT_COOKIE = "motoops_support";

/** Duración del modo soporte: se cierra solo pasado este tiempo. */
export const SUPPORT_MAX_AGE = 60 * 60 * 4;
