"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { CustomerFormSheet } from "@/components/customers/customer-form-sheet";
import { Button } from "@/components/ui/button";
import type { CustomerProfile } from "@/lib/customers/types";

export function EditCustomerButton({ customer }: { customer: CustomerProfile }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="lg" className="h-9 px-3" onClick={() => setOpen(true)}>
        <Pencil data-icon="inline-start" />
        Editar
      </Button>
      <CustomerFormSheet open={open} onOpenChange={setOpen} customer={customer} />
    </>
  );
}
