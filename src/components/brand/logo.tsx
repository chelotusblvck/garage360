import { Motorbike } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground",
        className
      )}
      aria-hidden
    >
      <Motorbike className="size-4.5" />
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-base font-semibold tracking-tight">MotoOps</span>
    </span>
  );
}
