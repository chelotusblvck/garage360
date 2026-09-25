export { cn } from "cn"

/** Minúsculas y sin tildes, para búsquedas tolerantes ("bujia" encuentra "Bujía"). */
export const normalizeText = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
