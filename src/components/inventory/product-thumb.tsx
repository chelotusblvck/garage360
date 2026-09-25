import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductThumb({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/5",
        className
      )}
    >
      {src ? (
        // Imágenes de Supabase Storage o data URLs (modo demo): <img> evita
        // configurar remotePatterns por proyecto.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <Package className="size-4 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}
