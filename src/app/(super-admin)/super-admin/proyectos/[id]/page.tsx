import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import { ArrowLeft, FolderOpen, Users, ClipboardList, Building2 } from "lucide-react";
import EquipoClient from "./equipo-client";

export const dynamic = "force-dynamic";

export default async function ProyectoSuperAdminDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: {
      constructora: { select: { id: true, nombre: true } },
      _count: { select: { edificios: true } },
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

  // Contratistas: usuarios CONTRATISTA con tareas asignadas en este proyecto
  const contratistas = await prisma.usuario.findMany({
    where: {
      constructora_id: proyecto.constructora_id,
      rol_ref: { nivel_acceso: "CONTRATISTA" },
      tareas_asignadas: {
        some: {
          espacio: {
            unidad: { piso: { edificio: { proyecto_id: proyecto.id } } },
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
  });

  // Personal de campo activo de la constructora cuyo contratista trabaja en este proyecto
  const contratistaIds = contratistas.map((c) => c.id);
  const obreros =
    contratistaIds.length > 0
      ? await prisma.obrero.findMany({
          where: {
            constructora_id: proyecto.constructora_id,
            contratista_id: { in: contratistaIds },
            activo: true,
          },
          select: {
            id: true,
            nombre: true,
            contratista_id: true,
            fecha_expiracion: true,
          },
        })
      : [];

  const tareasCount = await prisma.tarea.count({
    where: {
      espacio: { unidad: { piso: { edificio: { proyecto_id: proyecto.id } } } },
    },
  });

  const stats = [
    { icon: Building2, color: "blue", label: "Edificios", value: proyecto._count.edificios },
    { icon: ClipboardList, color: "violet", label: "Tareas", value: tareasCount },
    { icon: Users, color: "yellow", label: "Admin Juniors", value: proyecto.admins_proyecto.length },
    { icon: Users, color: "green", label: "Contratistas", value: contratistas.length },
    { icon: Users, color: "orange", label: "Personal de campo activo", value: obreros.length },
  ];

  // Listas para hijo
  const adminsAsignados = proyecto.admins_proyecto.map((a) => ({
    accessId: a.id,
    usuario_id: a.usuario.id,
    nombre: a.usuario.nombre,
    email: a.usuario.email,
    rol: a.usuario.rol_ref.nombre,
  }));

  // Lista de Admin Juniors disponibles para asignar (de la misma constructora, no asignados aún)
  const adminsAsignadosIds = new Set(adminsAsignados.map((a) => a.usuario_id));
  const adminsDisponibles = await prisma.usuario.findMany({
    where: {
      constructora_id: proyecto.constructora_id,
      rol_ref: { nivel_acceso: "ADMIN_PROYECTO" },
      id: { notIn: Array.from(adminsAsignadosIds) },
    },
    select: { id: true, nombre: true, email: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <Topbar
        title={proyecto.nombre}
        subtitle={`${proyecto.constructora.nombre} · ${proyecto.estado}`}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Link
          href="/super-admin/proyectos"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a proyectos
        </Link>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {stats.map((s) => {
            const Icon = s.icon;
            const colorMap: Record<string, string> = {
              blue: "bg-blue-50 text-blue-600",
              violet: "bg-violet-50 text-violet-600",
              yellow: "bg-yellow-50 text-yellow-600",
              green: "bg-green-50 text-green-600",
              orange: "bg-orange-50 text-orange-600",
            };
            return (
              <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-3">
                <div className={`w-8 h-8 rounded-lg ${colorMap[s.color]} flex items-center justify-center mb-2`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-[11px] text-slate-500">{s.label}</div>
                <div className="text-lg font-bold text-slate-800">{s.value}</div>
              </div>
            );
          })}
        </div>

        <EquipoClient
          proyectoId={proyecto.id}
          adminsAsignados={adminsAsignados}
          adminsDisponibles={adminsDisponibles}
          contratistas={contratistas.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            email: c.email,
            rol: c.rol_ref.nombre,
            tareas: c._count.tareas_asignadas,
            obreros: c._count.obreros_a_cargo,
          }))}
          obreros={obreros.map((o) => ({
            id: o.id,
            nombre: o.nombre,
            contratista_id: o.contratista_id,
            expira: o.fecha_expiracion.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
