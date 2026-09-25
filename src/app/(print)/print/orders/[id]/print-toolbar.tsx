"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function PrintToolbar({ backHref, otherHref, otherLabel }: { backHref: string; otherHref: string; otherLabel: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 px-4 print:hidden">
      <Link href={backHref} className={buttonVariants({ variant: "ghost" })}>
        <ArrowLeft data-icon="inline-start" />
        Volver a la orden
      </Link>
      <Link href={otherHref} className={buttonVariants({ variant: "outline", className: "ml-auto" })}>
        {otherLabel}
      </Link>
      <Button onClick={() => window.print()}>
        <Printer data-icon="inline-start" />
        Imprimir / Guardar PDF
      </Button>
    </div>
  );
}
