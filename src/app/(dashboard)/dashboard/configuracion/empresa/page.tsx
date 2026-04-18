import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import EmpresaForm from "./EmpresaForm";

export default async function EmpresaPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (usuario.rol_ref.nivel_acceso !== "ADMIN_GENERAL") redirect("/dashboard");

  return (
    <>
      <Topbar title="Información de la constructora" subtitle="Datos generales de la empresa" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <EmpresaForm
          initialData={{
            nombre: usuario.constructora.nombre,
            nit: usuario.constructora.nit,
            logo_url: usuario.constructora.logo_url,
          }}
        />
      </main>
    </>
  );
}
