import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import {
  getAccessibleProjectIds,
  canAccessProject,
  isGeneralAdmin,
  isProjectAdmin,
  isSuperAdmin,
} from "@/lib/access";
import { nivelesConObrasAsignadas } from "@/lib/niveles-acceso";
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
              rol_ref: { select: { nombre: true, nivel_acceso: true } },
            },
          },
        },
      },
    },
  });

  if (!proyecto) notFound();

  // Personal del proyecto vinculadas al proyecto
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

  // AdminProyectoAccess no es solo de admins juniors: el personal de campo se
  // vincula a la obra por la misma tabla. Filtrar por ADMIN_PROYECTO dejaba a
  // los residentes fuera de la lista, y esta pantalla era el único sitio donde
  // se les podía añadir una obra después del alta.
  const adminsAsignadosIds = new Set(proyecto.admins_proyecto.map((a) => a.usuario.id));
  const asignablesDisponibles = await prisma.usuario.findMany({
    where: {
      constructora_id: usuario.constructora_id,
      rol_ref: { nivel_acceso: { in: nivelesConObrasAsignadas() } },
      id: { notIn: Array.from(adminsAsignadosIds) },
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol_ref: { select: { nombre: true, nivel_acceso: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const asignados = proyecto.admins_proyecto;
  const adminsJuniors = asignados.filter(
    (a) => a.usuario.rol_ref.nivel_acceso === "ADMIN_PROYECTO",
  ).length;
  const personalCampo = asignados.length - adminsJuniors;

  // El desplegable del hijo solo pinta nombre y email, así que el rol va dentro
  // del nombre: sin él, un admin junior y un residente se ven exactamente igual
  // en la lista y se acaba asignando al que no era.
  const opcionesAsignables = asignablesDisponibles.map((a) => ({
    id: a.id,
    nombre: `${a.nombre} · ${a.rol_ref.nombre}`,
    email: a.email,
    // El nivel viaja aparte del texto: el modal de permisos apaga las casillas
    // para un PERSONAL_CAMPO, y para eso necesita el dato, no la etiqueta.
    nivelAcceso: a.rol_ref.nivel_acceso,
  }));

  // Los permisos del que MIRA, obra a obra. Antes salía de aquí un único
  // `canAssign = can_manage_team || can_assign_contractors` que gobernaba dos
  // familias de botones distintas: con cualquiera de los dos permisos se pintaba
  // todo y la mitad devolvía 403. Son permisos separados en la API
  // (`/admins` y `/personas` piden can_manage_team; `/asignar-tareas` y
  // `/reasignar` piden can_assign_contractors), así que aquí van separados.
  //
  // DIRECTIVO, CONTRATISTA y PERSONAL_CAMPO se quedan en cero: llegan a esta
  // pantalla porque la obra está en su lista, pero las cuatro APIs de equipo
  // arrancan en `isAnyAdmin` y les responden 403.
  const nivelUsuario = usuario.rol_ref.nivel_acceso;
  const mandaEnTodaLaConstructora = isSuperAdmin(nivelUsuario) || isGeneralAdmin(nivelUsuario);

  let permisosEnObra = {
    can_edit_project: mandaEnTodaLaConstructora,
    can_assign_contractors: mandaEnTodaLaConstructora,
    can_manage_team: mandaEnTodaLaConstructora,
    can_approve_tasks: mandaEnTodaLaConstructora,
  };
  if (isProjectAdmin(nivelUsuario)) {
    const acceso = await prisma.adminProyectoAccess.findUnique({
      where: { usuario_id_proyecto_id: { usuario_id: usuario.id, proyecto_id: id } },
      select: {
        can_edit_project: true,
        can_assign_contractors: true,
        can_manage_team: true,
        can_approve_tasks: true,
      },
    });
    permisosEnObra = {
      can_edit_project: !!acceso?.can_edit_project,
      can_assign_contractors: !!acceso?.can_assign_contractors,
      can_manage_team: !!acceso?.can_manage_team,
      can_approve_tasks: !!acceso?.can_approve_tasks,
    };
  }

  return (
    <>
      <Topbar
        title={`Equipo · ${proyecto.nombre}`}
        subtitle={`${adminsJuniors} admin junior · ${personalCampo} personal de campo · ${contratistas.length} contratistas · ${personasExternas.length} externos`}
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
          puedeGestionarEquipo={permisosEnObra.can_manage_team}
          puedeAsignarContratistas={permisosEnObra.can_assign_contractors}
          // Techo de lo que puede repartir: `POST`/`PATCH` de /admins rechazan
          // otorgar un permiso que el actor no tiene en esta obra.
          permisosOtorgables={permisosEnObra}
          adminsAsignados={proyecto.admins_proyecto.map((a) => ({
            usuario_id: a.usuario.id,
            nombre: a.usuario.nombre,
            email: a.usuario.email,
            rol: a.usuario.rol_ref.nombre,
            nivelAcceso: a.usuario.rol_ref.nivel_acceso,
            permisos: {
              can_edit_project: a.can_edit_project,
              can_assign_contractors: a.can_assign_contractors,
              can_manage_team: a.can_manage_team,
              can_approve_tasks: a.can_approve_tasks,
            },
          }))}
          adminsDisponibles={opcionesAsignables}
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
