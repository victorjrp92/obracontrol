import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { calcularProgreso, calcularSemaforo, calcularDiasHabiles } from "@/lib/scoring";

// Usuario autenticado + perfil de la DB
export async function getUsuarioActual() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return prisma.usuario.findUnique({
    where: { email: user.email! },
    include: { constructora: true },
  });
}

// Stats del dashboard principal
export async function getDashboardStats(constructoraId: string) {
  const [
    proyectosActivos,
    tareasAprobadas,
    tareasReportadas,
    tareasPendientes,
    tareasNoAprobadas,
    contratistasActivos,
    tareasEnRiesgo,
  ] = await Promise.all([
    prisma.proyecto.count({ where: { constructora_id: constructoraId, estado: "ACTIVO" } }),
    prisma.tarea.count({
      where: { estado: "APROBADA", espacio: { unidad: { piso: { edificio: { proyecto: { constructora_id: constructoraId } } } } } },
    }),
    prisma.tarea.count({
      where: { estado: "REPORTADA", espacio: { unidad: { piso: { edificio: { proyecto: { constructora_id: constructoraId } } } } } },
    }),
    prisma.tarea.count({
      where: { estado: "PENDIENTE", espacio: { unidad: { piso: { edificio: { proyecto: { constructora_id: constructoraId } } } } } },
    }),
    prisma.tarea.count({
      where: { estado: "NO_APROBADA", espacio: { unidad: { piso: { edificio: { proyecto: { constructora_id: constructoraId } } } } } },
    }),
    prisma.usuario.count({
      where: {
        constructora_id: constructoraId,
        rol: { in: ["CONTRATISTA_INSTALADOR", "CONTRATISTA_LUSTRADOR"] },
      },
    }),
    // Tareas en rojo/vinotinto (retrasadas > 15%)
    prisma.tarea.count({
      where: {
        estado: { in: ["PENDIENTE", "REPORTADA"] },
        fecha_inicio: { not: null },
        espacio: { unidad: { piso: { edificio: { proyecto: { constructora_id: constructoraId } } } } },
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
export async function getProyectosConProgreso(constructoraId: string) {
  const proyectos = await prisma.proyecto.findMany({
    where: { constructora_id: constructoraId, estado: "ACTIVO" },
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
export async function getTareasRecientes(constructoraId: string, limite = 8, usuarioId?: string, rol?: string) {
  const ahora = new Date();
  const esContratista = rol === "CONTRATISTA_INSTALADOR" || rol === "CONTRATISTA_LUSTRADOR";

  const tareas = await prisma.tarea.findMany({
    where: {
      espacio: { unidad: { piso: { edificio: { proyecto: { constructora_id: constructoraId } } } } },
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
export async function getTopContratistas(constructoraId: string, limite = 3) {
  return prisma.contratista.findMany({
    where: { usuario: { constructora_id: constructoraId } },
    include: {
      usuario: { select: { nombre: true, rol: true } },
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
          rol: true,
          tareas_asignadas: { select: { estado: true } },
        },
      },
    },
    orderBy: { score_total: "desc" },
  });

  return contratistas.map((c) => ({
    id: c.id,
    nombre: c.usuario.nombre,
    rol: c.usuario.rol,
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
    select: { id: true, email: true, nombre: true, rol: true, created_at: true },
    orderBy: { created_at: "desc" },
  });
}

// Tareas para la página de tareas con filtros
export async function getTareasFiltradas(constructoraId: string, estado?: string, usuarioId?: string, rol?: string) {
  const ahora = new Date();
  const esContratista = rol === "CONTRATISTA_INSTALADOR" || rol === "CONTRATISTA_LUSTRADOR";

  const tareas = await prisma.tarea.findMany({
    where: {
      espacio: { unidad: { piso: { edificio: { proyecto: { constructora_id: constructoraId } } } } },
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
