import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { calcularProgreso, calcularSemaforo, calcularDiasHabiles } from "@/lib/scoring";
import type { AccessibleProjects } from "@/lib/access";

// Internal helper: returns a where-fragment scoped through the espacio→...→proyecto path
// when accessibleProjectIds is a list; returns `undefined` for "ALL" or when not passed.
function scopedProyectoConstructoraFilter(
  constructoraId: string,
  accessibleProjectIds?: AccessibleProjects,
) {
  if (accessibleProjectIds !== undefined && accessibleProjectIds !== "ALL") {
    return { constructora_id: constructoraId, id: { in: accessibleProjectIds } };
  }
  return { constructora_id: constructoraId };
}

// Usuario autenticado + perfil de la DB
export async function getUsuarioActual() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return prisma.usuario.findUnique({
    where: { email: user.email! },
    include: {
      constructora: true,
      rol_ref: true,
      proyectos_administrados: { select: { proyecto_id: true } },
    },
  });
}

// Stats del dashboard principal
export async function getDashboardStats(
  constructoraId: string,
  accessibleProjectIds?: AccessibleProjects,
) {
  const proyectoWhere = scopedProyectoConstructoraFilter(constructoraId, accessibleProjectIds);
  const proyectoPathFilter = { espacio: { unidad: { piso: { edificio: { proyecto: proyectoWhere } } } } };

  const [
    proyectosActivos,
    tareasAprobadas,
    tareasReportadas,
    tareasPendientes,
    tareasNoAprobadas,
    contratistasActivos,
    tareasEnRiesgo,
  ] = await Promise.all([
    prisma.proyecto.count({ where: { ...proyectoWhere, estado: "ACTIVO" } }),
    prisma.tarea.count({
      where: { estado: "APROBADA", ...proyectoPathFilter },
    }),
    prisma.tarea.count({
      where: { estado: "REPORTADA", ...proyectoPathFilter },
    }),
    prisma.tarea.count({
      where: { estado: "PENDIENTE", ...proyectoPathFilter },
    }),
    prisma.tarea.count({
      where: { estado: "NO_APROBADA", ...proyectoPathFilter },
    }),
    prisma.usuario.count({
      where: {
        constructora_id: constructoraId,
        rol_ref: { nivel_acceso: "CONTRATISTA" },
      },
    }),
    // Tareas en rojo/vinotinto (retrasadas > 15%)
    prisma.tarea.count({
      where: {
        estado: { in: ["PENDIENTE", "REPORTADA"] },
        fecha_inicio: { not: null },
        ...proyectoPathFilter,
      },
    }),
  ]);

  const total = tareasAprobadas + tareasReportadas + tareasPendientes + tareasNoAprobadas;
  const porcentajeAprobado = total > 0 ? Math.round((tareasAprobadas / total) * 100) : 0;

  return {
    proyectosActivos,
    tareasAprobadas,
    tareasReportadas,
    tareasPendientes,
    tareasNoAprobadas,
    contratistasActivos,
    tareasEnRiesgo,
    total,
    porcentajeAprobado,
  };
}

// Proyectos con progreso calculado
export async function getProyectosConProgreso(
  constructoraId: string,
  accessibleProjectIds?: AccessibleProjects,
) {
  const proyectoWhere = scopedProyectoConstructoraFilter(constructoraId, accessibleProjectIds);
  const proyectos = await prisma.proyecto.findMany({
    where: { ...proyectoWhere, estado: "ACTIVO" },
    include: {
      edificios: {
        include: {
          pisos: {
            include: {
              unidades: {
                include: {
                  espacios: {
                    include: { tareas: { select: { estado: true, tiempo_acordado_dias: true, fecha_inicio: true, fecha_fin_real: true, created_at: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { created_at: "desc" },
  });

  return proyectos.map((p) => {
    const todasTareas = p.edificios.flatMap((e) =>
      e.pisos.flatMap((pi) => pi.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas)))
    );
    const progreso = calcularProgreso(todasTareas);

    // Semáforo general: el peor de todas las tareas activas
    const ahora = new Date();
    const orden = ["verde-intenso", "verde", "amarillo", "rojo", "vinotinto"];
    const semaforo = todasTareas
      .filter((t) => t.fecha_inicio)
      .map((t) => {
        const dias = calcularDiasHabiles(t.fecha_inicio!, t.fecha_fin_real ?? ahora, p.dias_habiles_semana);
        return calcularSemaforo(t.tiempo_acordado_dias, dias, t.estado === "APROBADA");
      })
      .reduce((peor, actual) =>
        orden.indexOf(actual) > orden.indexOf(peor) ? actual : peor,
        "verde" as string
      );

    return {
      ...p,
      progreso,
      semaforo,
      totalUnidades: p.edificios.flatMap((e) => e.pisos.flatMap((pi) => pi.unidades)).length,
    };
  });
}

// Tareas recientes con toda la info necesaria para el dashboard
export async function getTareasRecientes(
  constructoraId: string,
  limite = 8,
  usuarioId?: string,
  nivelAcceso?: string,
  accessibleProjectIds?: AccessibleProjects,
) {
  const ahora = new Date();
  const esContratista = nivelAcceso === "CONTRATISTA";
  const proyectoWhere = scopedProyectoConstructoraFilter(constructoraId, accessibleProjectIds);

  const tareas = await prisma.tarea.findMany({
    where: {
      espacio: { unidad: { piso: { edificio: { proyecto: proyectoWhere } } } },
      estado: { not: "APROBADA" },
      ...(esContratista && usuarioId ? { asignado_a: usuarioId } : {}),
    },
    include: {
      espacio: {
        include: {
          unidad: {
            include: { piso: { include: { edificio: { include: { proyecto: true } } } } },
          },
        },
      },
      fase: true,
      asignado_usuario: { select: { nombre: true } },
    },
    orderBy: { updated_at: "desc" },
    take: limite,
  });

  return tareas.map((t) => {
    const proyecto = t.espacio.unidad.piso.edificio.proyecto;
    const diasSemanales = proyecto.dias_habiles_semana;
    const inicio = t.fecha_inicio ?? t.created_at;
    const diasTranscurridos = calcularDiasHabiles(inicio, ahora, diasSemanales);
    const semaforo = calcularSemaforo(t.tiempo_acordado_dias, diasTranscurridos, t.estado === "APROBADA");

    const diasRestantes = t.tiempo_acordado_dias - diasTranscurridos;

    return {
      id: t.id,
      nombre: t.nombre,
      proyecto: proyecto.nombre,
      unidad: `${t.espacio.unidad.piso.edificio.nombre} · Apto ${t.espacio.unidad.nombre}`,
      status: t.estado,
      semaforo,
      daysLeft: diasRestantes,
      contractor: t.asignado_usuario?.nombre,
    };
  });
}

// Top contratistas por score
export async function getTopContratistas(
  constructoraId: string,
  limite = 3,
  accessibleProjectIds?: AccessibleProjects,
) {
  // Base scope: contratistas of this constructora.
  const baseWhere: Record<string, unknown> = { usuario: { constructora_id: constructoraId } };

  // When project-scoped, narrow to contratistas with at least one task in an accessible project.
  if (accessibleProjectIds !== undefined && accessibleProjectIds !== "ALL") {
    baseWhere.usuario = {
      constructora_id: constructoraId,
      tareas_asignadas: {
        some: {
          espacio: {
            unidad: {
              piso: {
                edificio: {
                  proyecto: { id: { in: accessibleProjectIds } },
                },
              },
            },
          },
        },
      },
    };
  }

  return prisma.contratista.findMany({
    where: baseWhere,
    include: {
      usuario: { select: { nombre: true, rol_ref: { select: { nombre: true } } } },
    },
    orderBy: { score_total: "desc" },
    take: limite,
  });
}

// Todos los contratistas con conteo de tareas
export async function getContratistas(constructoraId: string) {
  const contratistas = await prisma.contratista.findMany({
    where: { usuario: { constructora_id: constructoraId } },
    include: {
      usuario: {
        select: {
          nombre: true,
          rol_ref: { select: { nombre: true } },
          tareas_asignadas: { select: { estado: true } },
        },
      },
    },
    orderBy: { score_total: "desc" },
  });

  return contratistas.map((c) => ({
    id: c.id,
    nombre: c.usuario.nombre,
    rol: c.usuario.rol_ref.nombre,
    score_total: c.score_total,
    score_cumplimiento: c.score_cumplimiento,
    score_calidad: c.score_calidad,
    score_velocidad_correccion: c.score_velocidad_correccion,
    tasksCompleted: c.usuario.tareas_asignadas.filter((t) => t.estado === "APROBADA").length,
    tasksPending: c.usuario.tareas_asignadas.filter(
      (t) => t.estado !== "APROBADA" && t.estado !== "NO_APROBADA"
    ).length,
  }));
}

// Usuarios de la constructora
export async function getUsuarios(constructoraId: string) {
  return prisma.usuario.findMany({
    where: { constructora_id: constructoraId },
    select: { id: true, email: true, nombre: true, rol_id: true, rol_ref: { select: { nombre: true, nivel_acceso: true } }, created_at: true },
    orderBy: { created_at: "desc" },
  });
}

// Proyectos activos (lightweight, for dropdowns)
export async function getProyectosActivos(
  constructoraId: string,
  accessibleProjectIds?: AccessibleProjects,
) {
  const proyectoWhere = scopedProyectoConstructoraFilter(constructoraId, accessibleProjectIds);
  return prisma.proyecto.findMany({
    where: { ...proyectoWhere, estado: "ACTIVO" },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}

// Tareas para la página de tareas con filtros
export async function getTareasFiltradas(
  constructoraId: string,
  estado?: string,
  usuarioId?: string,
  nivelAcceso?: string,
  proyectoId?: string,
  accessibleProjectIds?: AccessibleProjects,
) {
  const ahora = new Date();
  const esContratista = nivelAcceso === "CONTRATISTA";
  const scoped = accessibleProjectIds !== undefined && accessibleProjectIds !== "ALL";
  // If project-scoped AND a specific proyectoId is requested, ensure the requested id
  // is actually accessible — otherwise clamp to a filter that will match nothing.
  let proyectoWhere: Record<string, unknown> = { constructora_id: constructoraId };
  if (scoped) {
    const allowed = accessibleProjectIds as string[];
    if (proyectoId) {
      proyectoWhere = allowed.includes(proyectoId)
        ? { constructora_id: constructoraId, id: proyectoId }
        : { constructora_id: constructoraId, id: { in: [] as string[] } };
    } else {
      proyectoWhere = { constructora_id: constructoraId, id: { in: allowed } };
    }
  } else if (proyectoId) {
    proyectoWhere = { constructora_id: constructoraId, id: proyectoId };
  }

  const tareas = await prisma.tarea.findMany({
    where: {
      espacio: { unidad: { piso: { edificio: { proyecto: proyectoWhere } } } },
      ...(estado && estado !== "ALL" ? { estado: estado as never } : {}),
      ...(esContratista && usuarioId ? { asignado_a: usuarioId } : {}),
    },
    include: {
      espacio: {
        include: {
          unidad: {
            include: { piso: { include: { edificio: { include: { proyecto: true } } } } },
          },
        },
      },
      asignado_usuario: { select: { nombre: true } },
    },
    orderBy: { updated_at: "desc" },
    take: 50,
  });

  return tareas.map((t) => {
    const proyecto = t.espacio.unidad.piso.edificio.proyecto;
    const inicio = t.fecha_inicio ?? t.created_at;
    const dias = calcularDiasHabiles(inicio, ahora, proyecto.dias_habiles_semana);
    const semaforo = calcularSemaforo(t.tiempo_acordado_dias, dias, t.estado === "APROBADA");
    const diasRestantes = t.tiempo_acordado_dias - dias;

    return {
      id: t.id,
      name: t.nombre,
      project: proyecto.nombre,
      unit: `${t.espacio.unidad.piso.edificio.nombre} · Apto ${t.espacio.unidad.nombre}`,
      status: t.estado as "PENDIENTE" | "REPORTADA" | "APROBADA" | "NO_APROBADA",
      semaforo: semaforo as "verde-intenso" | "verde" | "amarillo" | "rojo" | "vinotinto",
      daysLeft: diasRestantes,
      contractor: t.asignado_usuario?.nombre,
    };
  });
}
