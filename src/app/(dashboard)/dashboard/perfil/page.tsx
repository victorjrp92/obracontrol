import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import PerfilForm from "./PerfilForm";

export default async function PerfilPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  return (
    <>
      <Topbar title="Mi perfil" />
      <PerfilForm
        nombre={usuario.nombre}
        email={usuario.email}
        telefono={usuario.telefono}
        avatarUrl={usuario.avatar_url}
        rol={usuario.rol_ref.nombre}
        nivelAcceso={usuario.rol_ref.nivel_acceso ?? ""}
        constructora={usuario.constructora?.nombre ?? ""}
      />
    </>
  );
}
