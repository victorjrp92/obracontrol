import { redirect } from "next/navigation";
import { getUsuarioActual, getProyectosActivos } from "@/lib/data";
import { getAccessibleProjectIds } from "@/lib/access";
import { getRolLabel } from "@/lib/permissions";
import { esCuentaPersonal } from "@/lib/plan";
import { puedeInvitarloUnAdminProyecto } from "@/lib/niveles-acceso";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import UsuariosClient from "./client";

export default async function UsuariosPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  // Las cuentas personales no manejan usuarios/roles de empresa: su equipo se
  // gestiona en /dashboard/equipo (obreros). Evita exponer la pantalla de empresa.
  if (esCuentaPersonal(usuario.constructora?.tipo_cuenta ?? "CONSTRUCTORA")) {
    redirect("/dashboard/equipo");
  }

  const nivel = usuario.rol_ref.nivel_acceso;
  if (!["ADMIN_GENERAL", "ADMIN_PROYECTO", "DIRECTIVO"].includes(nivel)) {
    redirect("/dashboard");
  }

  const usuarios = await prisma.usuario.findMany({
    where: { constructora_id: usuario.constructora_id },
    include: {
      rol_ref: true,
      proyectos_administrados: { select: { proyecto_id: true } },
    },
    orderBy: { created_at: "desc" },
  });
  const roles = await prisma.rol.findMany({
    where: { constructora_id: usuario.constructora_id },
    select: { id: true, nombre: true, nivel_acceso: true },
    orderBy: { nombre: "asc" },
  });
  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    nivel,
  );
  const proyectos = await getProyectosActivos(usuario.constructora_id, accessible);

  // Un ADMIN_PROYECTO da de alta a quien trabaja en su obra: contratistas,
  // maestros y personal de campo. La lista tiene que decir lo mismo que valida
  // POST /api/usuarios; mientras filtró solo CONTRATISTA|OBRERO, el admin de la
  // obra —el único que conoce a sus residentes— no podía darlos de alta aunque
  // la API se lo permitiera.
  const rolesVisibles =
    nivel === "ADMIN_PROYECTO"
      ? roles.filter((r) => puedeInvitarloUnAdminProyecto(r.nivel_acceso))
      : roles;

  const mapped = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol_ref.nombre,
    rol_id: u.rol_id,
    nivel_acceso: u.rol_ref.nivel_acceso,
    rolLabel: getRolLabel(u.rol_ref.nombre),
    invitado: u.invitado,
    created_at: u.created_at.toISOString(),
    proyectos_ids: u.proyectos_administrados.map((a) => a.proyecto_id),
  }));

  return (
    <>
      <Topbar title="Usuarios" subtitle="Gestión del equipo" />
      <UsuariosClient
        usuarios={mapped}
        roles={rolesVisibles}
        proyectos={proyectos}
      />
    </>
  );
}
