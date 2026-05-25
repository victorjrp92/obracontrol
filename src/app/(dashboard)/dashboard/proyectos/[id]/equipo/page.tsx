import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { getAccessibleProjectIds, canAccessProject } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import { ArrowLeft } from "lucide-react";
import EquipoAdminGeneral from "./client";

export const dynamic = "force-dynamic";

export default async function EquipoProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const { id } = await params;
  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  if (!canAccessProject(accessible, id)) redirect("/dashboard/proyectos");

  const proyecto = await prisma.proyecto.findFirst({
    where: { id, constructora_id: usuario.constructora_id },
    include: {
      admins_proyecto: {
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              email: true,
              rol_ref: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });

  if (!proyecto) notFound();

  // Personas externas vinculadas al proyecto
  const personasExternas = await prisma.personaExternaProyecto.findMany({
    where: { proyecto_id: id },
    orderBy: { created_at: "desc" },
  });

  // Contratistas con tareas en el proyecto
  const contratistas = await prisma.usuario.findMany({
    where: {
      constructora_id: usuario.constructora_id,
      rol_ref: { nivel_acceso: "CONTRATISTA" },
      tareas_asignadas: {
        some: {
          espacio: {
            unidad: { piso: { edificio: { proyecto_id: id } } },
          },
        },
      },
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol_ref: { select: { nombre: true } },
      _count: { select: { tareas_asignadas: true, obreros_a_cargo: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const adminsAsignadosIds = new Set(proyecto.admins_proyecto.map((a) => a.usuario.id));
  const adminsDisponibles = await prisma.usuario.findMany({
    where: {
      constructora_id: usuario.constructora_id,
      rol_ref: { nivel_acceso: "ADMIN_PROYECTO" },
      id: { notIn: Array.from(adminsAsignadosIds) },
    },
    select: { id: true, nombre: true, email: true },
    orderBy: { nombre: "asc" },
  });

  // ADMIN_GENERAL siempre. ADMIN_PROYECTO solo si tiene can_manage_team o
  // can_assign_contractors sobre este proyecto (la API hace el gate granular real).
  // DIRECTIVO se excluye porque el endpoint /admins solo acepta ADMIN_GENERAL para
  // crear/modificar admin juniors.
  let canAssign = usuario.rol_ref.nivel_acceso === "ADMIN_GENERAL";
  if (!canAssign && usuario.rol_ref.nivel_acceso === "ADMIN_PROYECTO") {
    const acceso = await prisma.adminProyectoAccess.findUnique({
      where: { usuario_id_proyecto_id: { usuario_id: usuario.id, proyecto_id: id } },
      select: { can_manage_team: true, can_assign_contractors: true },
    });
    canAssign = !!(acceso?.can_manage_team || acceso?.can_assign_contractors);
  }

  return (
    <>
      <Topbar
        title={`Equipo · ${proyecto.nombre}`}
        subtitle={`${proyecto.admins_proyecto.length} admin junior · ${contratistas.length} contratistas · ${personasExternas.length} externos`}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Link
          href={`/dashboard/proyectos/${id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al proyecto
        </Link>

        <EquipoAdminGeneral
          proyectoId={proyecto.id}
          canAssign={canAssign}
          adminsAsignados={proyecto.admins_proyecto.map((a) => ({
            usuario_id: a.usuario.id,
            nombre: a.usuario.nombre,
            email: a.usuario.email,
            rol: a.usuario.rol_ref.nombre,
            permisos: {
              can_edit_project: a.can_edit_project,
              can_assign_contractors: a.can_assign_contractors,
              can_manage_team: a.can_manage_team,
              can_approve_tasks: a.can_approve_tasks,
            },
          }))}
          adminsDisponibles={adminsDisponibles}
          contratistas={contratistas.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            email: c.email,
            rol: c.rol_ref.nombre,
            tareas: c._count.tareas_asignadas,
            obreros: c._count.obreros_a_cargo,
          }))}
          personasExternas={personasExternas.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            cargo: p.cargo,
            telefono: p.telefono,
            email: p.email,
          }))}
        />
      </main>
    </>
  );
}
