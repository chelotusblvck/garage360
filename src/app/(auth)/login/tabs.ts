/* Pestañas de /login (?tab=…). Fuera del módulo "use client" para leerlas en el servidor. */
export const LOGIN_TABS = ["ingresar", "catalogo", "cotizar"] as const;
export type LoginTab = (typeof LOGIN_TABS)[number];

export const parseLoginTab = (value: unknown): LoginTab =>
  LOGIN_TABS.find((t) => t === value) ?? "ingresar";
