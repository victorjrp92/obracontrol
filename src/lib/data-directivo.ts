import { prisma } from "@/lib/prisma";
import { calcularProgreso, calcularSemaforo, calcularDiasHabiles } from "@/lib/scoring";

// ── Stats ejecutivos del dashboard directivo ──────────────────────────────────
export async function getDirectivoStats(constructoraId: string) {
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
                    include: {
                      tareas: {
                        select: {
                          estado: true,
                          tiempo_acordado_dias: true,
                          fecha_inicio: true,
                          fecha_fin_real: true,
                          created_at: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const proyectosActivos = proyectos.length;

  let tareasTotal = 0;
  let tareasAprobadas = 0;
  let progresoSum = 0;
  let proyectosEnRiesgo = 0;

  for (const p of proyectos) {
    const todasTareas = p.edificios.flatMap((e) =>
      e.pisos.flatMap((pi) => pi.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas)))
    );
    tareasTotal += todasTareas.length;
    const aprobadas = todasTareas.filter((t) => t.estado === "APROBADA").length;
    tareasAprobadas += aprobadas;

    const progreso = calcularProgreso(todasTareas);
    progresoSum += progreso.porcentajeAprobado;

    // Proyecto en riesgo: más del 30% de tareas en rojo o vinotinto
    const ahora = new Date();
    const tareasEnRiesgo = todasTareas.filter((t) => {
      if (!t.fecha_inicio) return false;
      const dias = calcularDiasHabiles(t.fecha_inicio, t.fecha_fin_real ?? ahora, 5);
      const semaforo = calcularSemaforo(t.tiempo_acordado_dias, dias, t.estado === "APROBADA");
      return semaforo === "rojo" || semaforo === "vinotinto";
    }).length;

    if (todasTareas.length > 0 && tareasEnRiesgo / todasTareas.length > 0.3) {
      proyectosEnRiesgo++;
    }
  }

  const progresoPromedio =
    proyectosActivos > 0 ? Math.round(progresoSum / proyectosActivos) : 0;

  return {
    proyectosActivos,
    progresoPromedio,
    tareasAprobadas,
    tareasTotal,
    proyectosEnRiesgo,
  };
}

// ── Listado de proyectos activos con progreso y semáforo ─────────────────────
export async function getProyectosResumen(constructoraId: string) {
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
                    include: {
                      tareas: {
                        select: {
                          estado: true,
                          tiempo_acordado_dias: true,
                          fecha_inicio: true,
                          fecha_fin_real: true,
                          created_at: true,
                        },
                      },
                    },
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

    // Semáforo: el peor de todas las tareas activas
    const ahora = new Date();
    const orden = ["verde-intenso", "verde", "amarillo", "rojo", "vinotinto"];
    const semaforo = todasTareas
      .filter((t) => t.fecha_inicio)
      .map((t) => {
        const dias = calcularDiasHabiles(
          t.fecha_inicio!,
          t.fecha_fin_real ?? ahora,
          p.dias_habiles_semana
        );
        return calcularSemaforo(t.tiempo_acordado_dias, dias, t.estado === "APROBADA");
      })
      .reduce(
        (peor, actual) =>
          orden.indexOf(actual) > orden.indexOf(peor) ? actual : peor,
        "verde" as string
      );

    const totalEdificios = p.edificios.length;
    const totalUnidades = p.edificios.flatMap((e) =>
      e.pisos.flatMap((pi) => pi.unidades)
    ).length;

    return {
      id: p.id,
      nombre: p.nombre,
      progreso: {
        aprobado: progreso.porcentajeAprobado,
        reportado: progreso.porcentajeReportado,
      },
      semaforo,
      fechaFin: p.fecha_fin_estimada,
      totalEdificios,
      totalUnidades,
    };
  });
}

// ── Detalle de un proyecto para el drill-down directivo ──────────────────────
export async function getProyectoDetallado(proyectoId: string, constructoraId: string) {
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, constructora_id: constructoraId },
    include: {
      edificios: {
        orderBy: { nombre: "asc" },
        include: {
          pisos: {
            include: {
              unidades: {
                include: {
                  espacios: {
                    include: {
                      tareas: {
                        select: {
                          estado: true,
                          tiempo_acordado_dias: true,
                          fecha_inicio: true,
                          fecha_fin_real: true,
                          created_at: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!proyecto) return null;

  const ahora = new Date();

  // Progreso global del proyecto
  const todasTareas = proyecto.edificios.flatMap((e) =>
    e.pisos.flatMap((pi) => pi.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas)))
  );
  const progresoGlobal = calcularProgreso(todasTareas);

  // Distribución de estados de tareas
  const taskDistribution = {
    aprobadas: todasTareas.filter((t) => t.estado === "APROBADA").length,
    reportadas: todasTareas.filter((t) => t.estado === "REPORTADA").length,
    pendientes: todasTareas.filter((t) => t.estado === "PENDIENTE").length,
    noAprobadas: todasTareas.filter((t) => t.estado === "NO_APROBADA").length,
    total: todasTareas.length,
  };

  // Progreso por edificio
  const edificios = proyecto.edificios.map((e) => {
    const tareasEdificio = e.pisos.flatMap((pi) =>
      pi.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas))
    );
    const progreso = calcularProgreso(tareasEdificio);
    const totalUnidades = e.pisos.flatMap((pi) => pi.unidades).length;

    // Semáforo del edificio
    const semaforoOrden = ["verde-intenso", "verde", "amarillo", "rojo", "vinotinto"];
    const semaforo = tareasEdificio
      .filter((t) => t.fecha_inicio)
      .map((t) => {
        const dias = calcularDiasHabiles(
          t.fecha_inicio!,
          t.fecha_fin_real ?? ahora,
          proyecto.dias_habiles_semana
        );
        return calcularSemaforo(t.tiempo_acordado_dias, dias, t.estado === "APROBADA");
      })
      .reduce(
        (peor, actual) =>
          semaforoOrden.indexOf(actual) > semaforoOrden.indexOf(peor) ? actual : peor,
        "verde" as string
      );

    return {
      id: e.id,
      nombre: e.nombre,
      totalUnidades,
      tareasAprobadas: progreso.aprobadas,
      tareasTotales: tareasEdificio.length,
      aprobadoPct: progreso.porcentajeAprobado,
      reportadoPct: progreso.porcentajeReportado,
      esZonaComun: e.es_zona_comun,
      semaforo,
    };
  });

  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    fechaFin: proyecto.fecha_fin_estimada,
    fechaInicio: proyecto.fecha_inicio,
    totalEdificios: proyecto.edificios.length,
    totalUnidades: proyecto.edificios.flatMap((e) => e.pisos.flatMap((pi) => pi.unidades)).length,
    progresoGlobal,
    taskDistribution,
    edificios,
  };
}
