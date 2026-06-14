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
    prisma.tarea.findMany({
      where: {
        estado: { in: ["PENDIENTE", "NO_APROBADA"] },
        fecha_inicio: { not: null },
        tiempo_acordado_dias: { gt: 0 },
        ...proyectoPathFilter,
      },
      select: { fecha_inicio: true, tiempo_acordado_dias: true },
    }),
  ]);

  const ahora = new Date();
  const tareasEnRiesgoCount = tareasEnRiesgo.filter((t) => {
    const limite = new Date(t.fecha_inicio!.getTime() + t.tiempo_acordado_dias * 86400000);
    return limite < ahora;
  }).length;

  const total = tareasAprobadas + tareasReportadas + tareasPendientes + tareasNoAprobadas;
  const porcentajeAprobado = total > 0 ? Math.round((tareasAprobadas / total) * 100) : 0;

  return {
    proyectosActivos,
    tareasAprobadas,
    tareasReportadas,
    tareasPendientes,
    tareasNoAprobadas,
    contratistasActivos,
    tareasEnRiesgo: tareasEnRiesgoCount,
    total,
    porcentajeAprobado,
  };
}

// Proyectos con progreso calculado
export interface ProyectoMapaData {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  porcentaje: number;
  subtitulo?: string;
}

const TAREAS_PARA_PROGRESO = {
  edificios: {
    select: {
      pisos: {
        select: {
          unidades: {
            select: { espacios: { select: { tareas: { select: { estado: true } } } } },
          },
        },
      },
    },
  },
} as const;

function pctDeProyecto(p: {
  edificios: { pisos: { unidades: { espacios: { tareas: { estado: string }[] }[] }[] }[] }[];
}): number {
  const tareas = p.edificios.flatMap((e) =>
    e.pisos.flatMap((pi) => pi.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas))),
  );
  return calcularProgreso(tareas).porcentajeAprobado;
}

/**
 * Datos ligeros para el mapa de obras de una constructora (scoped por rol).
 * Devuelve los proyectos con coordenadas y la lista de los que no tienen
 * (para el banner "completa la ubicación").
 */
export async function getProyectosMapa(
  constructoraId: string,
  accessibleProjectIds?: AccessibleProjects,
): Promise<{ conUbicacion: ProyectoMapaData[]; sinUbicacion: { id: string; nombre: string }[] }> {
  const proyectoWhere = scopedProyectoConstructoraFilter(constructoraId, accessibleProjectIds);
  const proyectos = await prisma.proyecto.findMany({
    where: { ...proyectoWhere, estado: "ACTIVO" },
    select: { id: true, nombre: true, ubicacion_lat: true, ubicacion_lng: true, ...TAREAS_PARA_PROGRESO },
    orderBy: { created_at: "desc" },
  });

  const conUbicacion: ProyectoMapaData[] = [];
  const sinUbicacion: { id: string; nombre: string }[] = [];
  for (const p of proyectos) {
    if (p.ubicacion_lat != null && p.ubicacion_lng != null) {
      conUbicacion.push({
        id: p.id,
        nombre: p.nombre,
        lat: p.ubicacion_lat,
        lng: p.ubicacion_lng,
        porcentaje: pctDeProyecto(p),
      });
    } else {
      sinUbicacion.push({ id: p.id, nombre: p.nombre });
    }
  }
  return { conUbicacion, sinUbicacion };
}

/**
 * Mapa GLOBAL para Super Admin: TODAS las obras activas de TODA la plataforma,
 * sin importar constructora ni tipo de cuenta. El subtítulo muestra la
 * constructora dueña. Inteligencia de negocio interna.
 */
export async function getProyectosMapaGlobal(): Promise<ProyectoMapaData[]> {
  const proyectos = await prisma.proyecto.findMany({
    where: {
      estado: "ACTIVO",
      ubicacion_lat: { not: null },
      ubicacion_lng: { not: null },
    },
    select: {
      id: true,
      nombre: true,
      ubicacion_lat: true,
      ubicacion_lng: true,
      constructora: { select: { nombre: true } },
      ...TAREAS_PARA_PROGRESO,
    },
    orderBy: { created_at: "desc" },
  });

  return proyectos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    lat: p.ubicacion_lat as number,
    lng: p.ubicacion_lng as number,
    porcentaje: pctDeProyecto(p),
    subtitulo: p.constructora?.nombre,
  }));
}

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

// Tareas reportadas pendientes de aprobación (requieren acción del admin)
export async function getTareasParaAprobar(
  constructoraId: string,
  limite = 6,
  accessibleProjectIds?: AccessibleProjects,
) {
  const ahora = new Date();
  const proyectoWhere = scopedProyectoConstructoraFilter(constructoraId, accessibleProjectIds);

  const tareas = await prisma.tarea.findMany({
    where: {
      estado: "REPORTADA",
      espacio: { unidad: { piso: { edificio: { proyecto: proyectoWhere } } } },
    },
    select: {
      id: true,
      nombre: true,
      tiempo_acordado_dias: true,
      fecha_inicio: true,
      created_at: true,
      asignado_usuario: { select: { nombre: true } },
      espacio: {
        select: {
          nombre: true,
          unidad: {
            select: {
              nombre: true,
              piso: {
                select: {
                  edificio: {
                    select: {
                      nombre: true,
                      proyecto: { select: { nombre: true, dias_habiles_semana: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { updated_at: "desc" },
    take: limite,
  });

  return tareas.map((t) => {
    const proyecto = t.espacio.unidad.piso.edificio.proyecto;
    const inicio = t.fecha_inicio ?? t.created_at;
    const diasTranscurridos = calcularDiasHabiles(inicio, ahora, proyecto.dias_habiles_semana);
    const diasRestantes = t.tiempo_acordado_dias - diasTranscurridos;
    const semaforo = calcularSemaforo(t.tiempo_acordado_dias, diasTranscurridos, false);

    return {
      id: t.id,
      nombre: t.nombre,
      proyecto: proyecto.nombre,
      unidad: `${t.espacio.unidad.piso.edificio.nombre} · Apto ${t.espacio.unidad.nombre}`,
      espacio: t.espacio.nombre,
      contratista: t.asignado_usuario?.nombre,
      diasRestantes,
      semaforo,
    };
  });
}

// Resumen de actividad de los últimos 7 días
export async function getResumenSemanal(
  constructoraId: string,
  accessibleProjectIds?: AccessibleProjects,
) {
  const hace7Dias = new Date();
  hace7Dias.setDate(hace7Dias.getDate() - 7);

  const proyectoWhere = scopedProyectoConstructoraFilter(constructoraId, accessibleProjectIds);
  const proyectoPathFilter = { espacio: { unidad: { piso: { edificio: { proyecto: proyectoWhere } } } } };

  const [aprobadas, reportadas, rechazadas] = await Promise.all([
    prisma.tarea.count({
      where: { estado: "APROBADA", updated_at: { gte: hace7Dias }, ...proyectoPathFilter },
    }),
    prisma.tarea.count({
      where: { estado: "REPORTADA", updated_at: { gte: hace7Dias }, ...proyectoPathFilter },
    }),
    prisma.tarea.count({
      where: { estado: "NO_APROBADA", updated_at: { gte: hace7Dias }, ...proyectoPathFilter },
    }),
  ]);

  return { aprobadas, reportadas, rechazadas, total: aprobadas + reportadas + rechazadas };
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
  faseId?: string,
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
      ...(faseId ? { fase_id: faseId } : {}),
    },
    include: {
      espacio: {
        include: {
          unidad: {
            include: { piso: { include: { edificio: { include: { proyecto: true } } } } },
          },
        },
      },
      fase: { select: { id: true, nombre: true, orden: true } },
      asignado_usuario: { select: { nombre: true } },
    },
    orderBy: [{ fase: { orden: "asc" } }, { nombre: "asc" }],
  });

  return tareas.map((t) => {
    const proyecto = t.espacio.unidad.piso.edificio.proyecto;
    const inicio = t.fecha_inicio ?? t.created_at;
    const dias = calcularDiasHabiles(inicio, ahora, proyecto.dias_habiles_semana);
    const semaforo = calcularSemaforo(t.tiempo_acordado_dias, dias, t.estado === "APROBADA");
    const diasRestantes = t.tiempo_acordado_dias - dias;

    return {
      // New fields for TareasTable
      id: t.id,
      numeroRegistro: t.numero_registro ?? null,
      nombre: `${t.espacio.nombre} — ${t.nombre}`,
      contratista: t.asignado_usuario?.nombre ?? null,
      diasEstimados: t.tiempo_acordado_dias,
      plazo: diasRestantes,
      estado: t.estado as "PENDIENTE" | "REPORTADA" | "APROBADA" | "NO_APROBADA",
      faseId: t.fase.id,
      subfase: t.subfase ?? null,
      precio: t.precio ?? null,
      faseNombre: t.fase.nombre,
      faseOrden: t.fase.orden,
      fechaInicio: t.fecha_inicio,
      // Backward-compatible fields for dashboard TaskRow
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
