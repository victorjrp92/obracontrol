import { redirect } from "next/navigation";
import { getUsuarioActual, getUsuarios } from "@/lib/data";
import { getRolLabel } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import UsuariosClient from "./client";

export default async function UsuariosPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (!["ADMINISTRADOR", "DIRECTIVO"].includes(usuario.rol_ref.nivel_acceso)) redirect("/dashboard");

  const usuarios = await getUsuarios(usuario.constructora_id);
  const roles = await prisma.rol.findMany({
    where: { constructora_id: usuario.constructora_id },
    select: { id: true, nombre: true, nivel_acceso: true },
    orderBy: { nombre: "asc" },
  });

  const mapped = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol_ref.nombre,
    rol_id: (u as unknown as { rol_id: string }).rol_id,
    rolLabel: getRolLabel(u.rol_ref.nombre),
    created_at: u.created_at.toISOString(),
  }));

  return (
    <>
      <Topbar title="Usuarios" subtitle="Gestión del equipo" />
      <UsuariosClient usuarios={mapped} roles={roles} />
    </>
  );
}
