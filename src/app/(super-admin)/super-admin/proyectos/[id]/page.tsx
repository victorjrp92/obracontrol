import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import { ArrowLeft, FolderOpen, Users, ClipboardList, Building2, HardHat, UserRound } from "lucide-react";
import { nivelesConObrasAsignadas } from "@/lib/niveles-acceso";
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
              rol_ref: { select: { nombre: true, nivel_acceso: true } },
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

  // Maestros activos de la constructora cuyo contratista trabaja en este proyecto.
  // Ojo: `Obrero` es el maestro que reporta por token, NO el rol PERSONAL_CAMPO.
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

  // AdminProyectoAccess mezcla dos niveles: el admin junior que administra la
  // obra y el personal de campo que solo reporta. Contarlos juntos leía como si
  // la obra tuviera más administradores de los que tiene.
  const adminsJuniors = proyecto.admins_proyecto.filter(
    (a) => a.usuario.rol_ref.nivel_acceso === "ADMIN_PROYECTO",
  ).length;
  const personalCampo = proyecto.admins_proyecto.length - adminsJuniors;

  // «Maestros activos» y no «Personal de campo activo»: este KPI cuenta filas de
  // `Obrero` (el maestro), y «personal de campo» ya nombra al rol PERSONAL_CAMPO.
  const stats = [
    { icon: Building2, color: "blue", label: "Edificios", value: proyecto._count.edificios },
    { icon: ClipboardList, color: "violet", label: "Tareas", value: tareasCount },
    { icon: Users, color: "yellow", label: "Admin Juniors", value: adminsJuniors },
    { icon: UserRound, color: "teal", label: "Personal de campo", value: personalCampo },
    { icon: Users, color: "green", label: "Contratistas", value: contratistas.length },
    { icon: HardHat, color: "orange", label: "Maestros activos", value: obreros.length },
  ];

  // Listas para hijo
  const adminsAsignados = proyecto.admins_proyecto.map((a) => ({
    accessId: a.id,
    usuario_id: a.usuario.id,
    nombre: a.usuario.nombre,
    email: a.usuario.email,
    rol: a.usuario.rol_ref.nombre,
  }));

  // Disponibles para vincular a la obra: admins juniors Y personal de campo.
  // Las dos clases comparten AdminProyectoAccess, y filtrando por ADMIN_PROYECTO
  // el super admin nunca podía asignarle una obra a un residente.
  const adminsAsignadosIds = new Set(adminsAsignados.map((a) => a.usuario_id));
  const asignablesDisponibles = await prisma.usuario.findMany({
    where: {
      constructora_id: proyecto.constructora_id,
      rol_ref: { nivel_acceso: { in: nivelesConObrasAsignadas() } },
      id: { notIn: Array.from(adminsAsignadosIds) },
    },
    select: { id: true, nombre: true, email: true, rol_ref: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  });

  // El desplegable del hijo solo pinta nombre y email: sin el rol dentro del
  // nombre, un admin junior y un residente se ven idénticos en la lista.
  const opcionesAsignables = asignablesDisponibles.map((a) => ({
    id: a.id,
    nombre: `${a.nombre} · ${a.rol_ref.nombre}`,
    email: a.email,
  }));

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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {stats.map((s) => {
            const Icon = s.icon;
            const colorMap: Record<string, string> = {
              blue: "bg-blue-50 text-blue-600",
              violet: "bg-violet-50 text-violet-600",
              yellow: "bg-yellow-50 text-yellow-600",
              green: "bg-green-50 text-green-600",
              orange: "bg-orange-50 text-orange-600",
              teal: "bg-teal-50 text-teal-600",
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
          adminsDisponibles={opcionesAsignables}
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
