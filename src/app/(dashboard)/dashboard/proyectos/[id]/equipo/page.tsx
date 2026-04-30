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

  // Solo el ADMIN_GENERAL puede asignar Admin Junior; ADMIN_PROYECTO solo ve.
  const canAssign =
    usuario.rol_ref.nivel_acceso === "ADMIN_GENERAL" ||
    usuario.rol_ref.nivel_acceso === "DIRECTIVO";

  return (
    <>
      <Topbar
        title={`Equipo · ${proyecto.nombre}`}
        subtitle={`${proyecto.admins_proyecto.length} admin junior · ${contratistas.length} contratistas`}
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
        />
      </main>
    </>
  );
}
