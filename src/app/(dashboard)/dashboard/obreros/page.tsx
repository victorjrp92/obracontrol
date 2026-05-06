import { redirect } from "next/navigation";

// El ranking global de obreros (con scoring + datos personales) es exclusivo
// de SUPER_ADMIN. Vive en /super-admin/obreros.
export default function ObrerosLegacyRedirect() {
  redirect("/dashboard");
}
