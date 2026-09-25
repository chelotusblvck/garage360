import { redirect } from "next/navigation";

/** Alias público: /appointments → agenda online. */
export default function AppointmentsAlias() {
  redirect("/booking");
}
