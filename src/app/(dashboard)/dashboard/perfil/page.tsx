import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import PerfilForm from "./form";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  return (
    <>
      <Topbar title="Mi perfil" subtitle="Información personal y configuración de cuenta" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl">
          <PerfilForm
            usuario={{
              id: usuario.id,
              nombre: usuario.nombre,
              email: usuario.email,
              rol: usuario.rol_ref.nombre,
              nivel_acceso: usuario.rol_ref.nivel_acceso,
              constructora: usuario.constructora?.nombre ?? "—",
              created_at: usuario.created_at.toISOString(),
            }}
          />
        </div>
      </main>
    </>
  );
}
