import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { canManageUsers } from "@/lib/access";
import Topbar from "@/components/dashboard/Topbar";
import EmpresaForm from "./EmpresaForm";

export default async function EmpresaPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (!canManageUsers(usuario.rol_ref.nivel_acceso)) redirect("/dashboard");

  const c = usuario.constructora;

  return (
    <>
      <Topbar title="Información de la constructora" subtitle="Datos generales de la empresa" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <EmpresaForm
          initialData={{
            nombre: c.nombre,
            nit: c.nit ?? "",
            logo_url: c.logo_url,
            direccion: c.direccion ?? "",
            ciudad: c.ciudad ?? "",
            telefono: c.telefono ?? "",
            sitio_web: c.sitio_web ?? "",
            descripcion: c.descripcion ?? "",
          }}
        />
      </main>
    </>
  );
}
