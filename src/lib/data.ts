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

/** Los cuatro estados de `EstadoTarea`, para reconstruir la lista de etiquetas
 *  desde los conteos que devuelve la base. */
const ESTADOS_TAREA = ["PENDIENTE", "REPORTADA", "APROBADA", "NO_APROBADA"] as const;

/** Una fila de la consulta de agregados: un proyecto × una tarea empezada.
 *  Los agregados se repiten en cada fila del proyecto (son cuatro enteros). */
interface FilaProgreso {
  proyecto_id: string;
  edificios: number;
  unidades: number;
  total: number;
  n_pendiente: number;
  n_reportada: number;
  n_aprobada: number;
  n_no_aprobada: number;
  // Nulos cuando el proyecto no tiene ninguna tarea empezada.
  estado: string | null;
  tiempo_acordado_dias: number | null;
  fecha_inicio: Date | null;
  fecha_fin_real: Date | null;
}

/**
 * Proyectos activos con su progreso y su semáforo. Lo consumen el dashboard,
 * la lista de proyectos y el selector de reportes.
 *
 * ── POR QUÉ ESTÁ ESCRITA ASÍ ────────────────────────────────────────────────
 *
 * Antes traía el árbol entero —`edificios → pisos → unidades → espacios →
 * tareas`— solo para contar cuántas tareas hay en cada estado. Prisma resuelve
 * cada nivel de un `include` anidado como una CONSULTA APARTE y luego las cose
 * en memoria: seis viajes a la base y 4.110 tareas cosidas para producir dos
 * porcentajes. Sobre la obra del demo eso medía 766 ms.
 *
 * Lo que de verdad se paga aquí no es el cómputo: es cada viaje. Medido contra
 * la base real, una consulta trivial cuesta ~110 ms de ida y vuelta, y las
 * consultas de abajo cuestan casi eso mismo —el trabajo en el servidor es
 * ruido al lado de la latencia—. Por eso el objetivo no fue «consultas más
 * ligeras» sino MENOS VIAJES: de seis encadenados a dos.
 *
 * `groupBy` de Prisma no llega: `Tarea` no tiene `proyecto_id` —el proyecto
 * está cinco relaciones más arriba— y no se puede agrupar por un campo de un
 * ancestro. De ahí el `$queryRaw` con los joins explícitos, igual que en
 * `data-velocidad.ts`.
 *
 * Las dos van EN SERIE a propósito. Lanzarlas con `Promise.all` no las
 * solapa —medido: 228 ms en serie contra 266 ms «en paralelo»; la consulta
 * pesada y la de Prisma no se superponen en esta conexión— y obligaría a
 * reescribir el alcance de acceso dentro del SQL. Así la regla de quién ve qué
 * proyecto sigue viviendo en un solo sitio, `scopedProyectoConstructoraFilter`,
 * y la segunda consulta solo recibe los ids que la primera ya resolvió.
 *
 * El semáforo sí necesita fila por fila (cada tarea tiene sus fechas y sus
 * días acordados), pero solo de las tareas EMPEZADAS —`fecha_inicio` no nula,
 * el mismo filtro de antes— y planas, sin el árbol encima.
 */
export async function getProyectosConProgreso(
  constructoraId: string,
  accessibleProjectIds?: AccessibleProjects,
) {
  const proyectoWhere = scopedProyectoConstructoraFilter(constructoraId, accessibleProjectIds);
  const proyectos = await prisma.proyecto.findMany({
    where: { ...proyectoWhere, estado: "ACTIVO" },
    orderBy: { created_at: "desc" },
  });
  if (proyectos.length === 0) return [];

  const ids = proyectos.map((p) => p.id);

  // UNA consulta para las tres cosas que antes salían del árbol: cuántas
  // tareas hay en cada estado, cuántas torres y unidades tiene la obra, y las
  // tareas empezadas que el semáforo necesita ver una por una.
  //
  // `obra` se calcula UNA vez y la reusan los dos agregados: en consultas
  // separadas cada una recorrería la misma tabla otra vez y, lanzadas a la
  // vez, se estorban entre ellas (medido: 2 × 116 ms sueltas → 508 ms juntas).
  //
  // `estructura` manda en el `left join` porque una obra puede tener torres y
  // ninguna tarea todavía —recién creada— y su tarjeta igual muestra «3 torres
  // · 60 unidades». Al revés no pasa: una tarea siempre cuelga de un edificio.
  //
  // El filtro de tenant va por `constructora_id` ADEMÁS del `in` de ids, igual
  // que en `data-velocidad.ts`: los ids salen de una consulta ya scoped, pero
  // dejar la pertenencia escrita en el SQL es lo que impide que un cambio
  // futuro en el primer paso se convierta en una fuga entre constructoras.
  const filas = await prisma.$queryRaw<FilaProgreso[]>`
      with alcance as (
        select pr.id
        from proyectos pr
        where pr.id = any(${ids}) and pr.constructora_id = ${constructoraId}
      ),
      obra as (
        select ed.proyecto_id,
               t.estado::text as estado,
               t.tiempo_acordado_dias,
               t.fecha_inicio,
               t.fecha_fin_real
        from tareas t
          join espacios  es on es.id = t.espacio_id
          join unidades  u  on u.id  = es.unidad_id
          join pisos     pi on pi.id = u.piso_id
          join edificios ed on ed.id = pi.edificio_id
        where ed.proyecto_id in (select id from alcance)
      ),
      conteos as (
        select proyecto_id,
               count(*)::int                                          as total,
               count(*) filter (where estado = 'PENDIENTE')::int       as n_pendiente,
               count(*) filter (where estado = 'REPORTADA')::int       as n_reportada,
               count(*) filter (where estado = 'APROBADA')::int        as n_aprobada,
               count(*) filter (where estado = 'NO_APROBADA')::int     as n_no_aprobada
        from obra
        group by proyecto_id
      ),
      estructura as (
        select ed.proyecto_id,
               count(distinct ed.id)::int as edificios,
               count(distinct u.id)::int  as unidades
        from edificios ed
          left join pisos    pi on pi.edificio_id = ed.id
          left join unidades u  on u.piso_id      = pi.id
        where ed.proyecto_id in (select id from alcance)
        group by ed.proyecto_id
      )
      select e.proyecto_id,
             e.edificios,
             e.unidades,
             coalesce(c.total, 0)          as total,
             coalesce(c.n_pendiente, 0)    as n_pendiente,
             coalesce(c.n_reportada, 0)    as n_reportada,
             coalesce(c.n_aprobada, 0)     as n_aprobada,
             coalesce(c.n_no_aprobada, 0)  as n_no_aprobada,
             o.estado,
             o.tiempo_acordado_dias,
             o.fecha_inicio,
             o.fecha_fin_real
      from estructura e
        left join conteos c on c.proyecto_id = e.proyecto_id
        left join obra    o on o.proyecto_id = e.proyecto_id and o.fecha_inicio is not null
  `;

  // Las filas llegan sueltas: cada proyecto tiene que encontrar las suyas sin
  // recorrer las 4.110.
  interface Acumulado {
    edificios: number;
    unidades: number;
    total: number;
    porEstado: Record<string, number>;
    empezadas: FilaProgreso[];
  }
  const porProyecto = new Map<string, Acumulado>();
  for (const f of filas) {
    let acc = porProyecto.get(f.proyecto_id);
    if (!acc) {
      acc = {
        edificios: f.edificios,
        unidades: f.unidades,
        total: f.total,
        porEstado: {
          PENDIENTE: f.n_pendiente,
          REPORTADA: f.n_reportada,
          APROBADA: f.n_aprobada,
          NO_APROBADA: f.n_no_aprobada,
        },
        empezadas: [],
      };
      porProyecto.set(f.proyecto_id, acc);
    }
    if (f.fecha_inicio !== null) acc.empezadas.push(f);
  }

  const ahora = new Date();
  const orden = ["verde-intenso", "verde", "amarillo", "rojo", "vinotinto"];

  return proyectos.map((p) => {
    const acc = porProyecto.get(p.id);

    // El porcentaje lo sigue calculando `calcularProgreso`, la MISMA función
    // de antes. Reescribir aquí la fórmula sería un segundo sitio donde el
    // redondeo puede separarse del que ve el resto de la app; lo único que
    // cambia es de dónde salen las tareas. Reexpandir los conteos son punteros
    // repetidos a cinco objetos, no cuatro mil tareas: lo que se ahorró es el
    // árbol, no esta lista.
    //
    // El relleno final cuadra el total por si algún día entra un estado nuevo
    // en el enum: sin él, esas tareas desaparecerían del denominador y el
    // porcentaje subiría solo.
    const etiquetas: { estado: string }[] = [];
    if (acc) {
      let contadas = 0;
      for (const estado of ESTADOS_TAREA) {
        const n = acc.porEstado[estado] ?? 0;
        contadas += n;
        // Un solo objeto por estado, repetido: `calcularProgreso` solo lee
        // `.estado` y no muta nada.
        const etiqueta = { estado };
        for (let i = 0; i < n; i++) etiquetas.push(etiqueta);
      }
      const otro = { estado: "OTRO" };
      for (let i = contadas; i < acc.total; i++) etiquetas.push(otro);
    }
    const progreso = calcularProgreso(etiquetas);

    // Semáforo general: el peor de todas las tareas activas
    const semaforo = (acc?.empezadas ?? [])
      .map((t) => {
        const dias = calcularDiasHabiles(t.fecha_inicio!, t.fecha_fin_real ?? ahora, p.dias_habiles_semana);
        return calcularSemaforo(t.tiempo_acordado_dias!, dias, t.estado === "APROBADA");
      })
      .reduce((peor, actual) =>
        orden.indexOf(actual) > orden.indexOf(peor) ? actual : peor,
        "verde" as string
      );

    return {
      ...p,
      progreso,
      semaforo,
      totalUnidades: acc?.unidades ?? 0,
      // Antes las páginas contaban `p.edificios.length` sobre el árbol; ahora
      // el número llega contado de la base y el árbol ya no viaja.
      totalEdificios: acc?.edificios ?? 0,
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
