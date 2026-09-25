import { cn } from "@/lib/utils";

const SIZE = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
} as const;

/**
 * Marca MotoOps: wordmark solo tipográfico, sin isotipo. "Moto" en semibold y
 * "Ops" en black. Usa currentColor, así que se lee igual sobre fondos claros y
 * oscuros (en un panel oscuro basta con text-zinc-50 en el contenedor).
 */
export function Wordmark({
  size = "md",
  tagline = false,
  className,
}: {
  size?: keyof typeof SIZE;
  /** Segunda línea «BY GARAGE360». */
  tagline?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span className={cn("tracking-tight", SIZE[size])}>
        <span className="font-semibold">Moto</span>
        <span className="font-black">Ops</span>
      </span>
      {tagline ? (
        <span className="mt-1 text-[10px] font-semibold tracking-widest uppercase opacity-60">by Garage360</span>
      ) : null}
    </span>
  );
}
