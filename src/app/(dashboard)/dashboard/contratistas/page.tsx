import { redirect } from "next/navigation";

// La vista global de contratistas con scoring es exclusiva de SUPER_ADMIN.
// Vive en /super-admin/contratistas.
export default function ContratistasLegacyRedirect() {
  redirect("/dashboard");
}
