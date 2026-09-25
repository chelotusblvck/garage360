"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function TicketToolbar({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    if (autoPrint) window.print();
  }, [autoPrint]);

  return (
    <div className="mx-auto mb-4 flex max-w-[80mm] flex-wrap items-center justify-center gap-2 px-4 print:hidden">
      <Link href="/dashboard/pos" className={buttonVariants({ variant: "ghost" })}>
        <ArrowLeft data-icon="inline-start" />
        Punto de venta
      </Link>
      <Button onClick={() => window.print()}>
        <Printer data-icon="inline-start" />
        Imprimir
      </Button>
    </div>
  );
}
