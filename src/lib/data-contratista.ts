import { prisma } from "@/lib/prisma";
import { calcularDiasHabiles, calcularSemaforo } from "@/lib/scoring";

// Tareas asignadas al contratista con semáforo y info completa
export async function getContratistaTareas(
  usuarioId: string,
  constructoraId: string,
  estado?: string
) {
  const ahora = new Date();

  const where: Record<string, unknown> = {
    asignado_a: usuarioId,
    espacio: {
      unidad: {
        piso: {
          edificio: {
            proyecto: { constructora_id: constructoraId },
          },
        },
      },
    },
  };

  if (estado && estado !== "TODAS") {
    where.estado = estado;
  }

  const tareas = await prisma.tarea.findMany({
    where,
    include: {
      espacio: {
        include: {
          unidad: {
            include: {
              piso: {
                include: {
                  edificio: {
                    include: { proyecto: true },
                  },
                },
              },
            },
          },
        },
      },
      aprobaciones: {
        orderBy: { fecha: "desc" },
        take: 1,
        include: { aprobador: { select: { nombre: true } } },
      },
    },
  });

  const resultado = tareas.map((t) => {
    const proyecto = t.espacio.unidad.piso.edificio.proyecto;
    const inicio = t.fecha_inicio ?? t.created_at;
    const dias = calcularDiasHabiles(inicio, ahora, proyecto.dias_habiles_semana);
    const semaforo = calcularSemaforo(t.tiempo_acordado_dias, dias, t.estado === "APROBADA");
    const diasRestantes = t.tiempo_acordado_dias - dias;
    const ultimaAprobacion = t.aprobaciones[0] ?? null;

    return {
      id: t.id,
      nombre: t.nombre,
      estado: t.estado,
      proyecto: proyecto.nombre,
      edificio: t.espacio.unidad.piso.edificio.nombre,
      unidad: t.espacio.unidad.nombre,
      semaforo,
      diasRestantes,
      justificacion: ultimaAprobacion?.justificacion_por_item
        ? JSON.stringify(ultimaAprobacion.justificacion_por_item)
        : null,
      aprobador: ultimaAprobacion?.aprobador?.nombre ?? null,
    };
  });

  // Order: PENDIENTE first, REPORTADA second, then the rest
  const ordenEstado: Record<string, number> = {
    PENDIENTE: 0,
    REPORTADA: 1,
    NO_APROBADA: 2,
    APROBADA: 3,
  };

  resultado.sort((a, b) => {
    const oa = ordenEstado[a.estado] ?? 99;
    const ob = ordenEstado[b.estado] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.diasRestantes - b.diasRestantes;
  });

  return resultado;
}

// Progreso agregado del contratista
export async function getContratistaProgreso(usuarioId: string) {
  const [total, aprobadas, reportadas, pendientes, noAprobadas] = await Promise.all([
    prisma.tarea.count({ where: { asignado_a: usuarioId } }),
    prisma.tarea.count({ where: { asignado_a: usuarioId, estado: "APROBADA" } }),
    prisma.tarea.count({ where: { asignado_a: usuarioId, estado: "REPORTADA" } }),
    prisma.tarea.count({ where: { asignado_a: usuarioId, estado: "PENDIENTE" } }),
    prisma.tarea.count({ where: { asignado_a: usuarioId, estado: "NO_APROBADA" } }),
  ]);

  const porcentajeAprobado = total > 0 ? Math.round((aprobadas / total) * 100) : 0;
  const porcentajeReportado =
    total > 0 ? Math.round(((aprobadas + reportadas) / total) * 100) : 0;

  return {
    total,
    aprobadas,
    reportadas,
    pendientes,
    noAprobadas,
    porcentajeAprobado,
    porcentajeReportado,
  };
}

// Historial de aprobaciones para el contratista
export async function getContratistaHistorial(
  usuarioId: string,
  constructoraId: string
) {
  const aprobaciones = await prisma.aprobacion.findMany({
    where: {
      tarea: {
        asignado_a: usuarioId,
        espacio: {
          unidad: {
            piso: {
              edificio: {
                proyecto: { constructora_id: constructoraId },
              },
            },
          },
        },
      },
    },
    include: {
      tarea: {
        include: {
          espacio: {
            include: {
              unidad: {
                include: {
                  piso: {
                    include: {
                      edificio: {
                        include: { proyecto: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      aprobador: { select: { nombre: true } },
    },
    orderBy: { fecha: "desc" },
  });

  return aprobaciones.map((a) => ({
    id: a.id,
    tarea: a.tarea.nombre,
    proyecto: a.tarea.espacio.unidad.piso.edificio.proyecto.nombre,
    edificio: a.tarea.espacio.unidad.piso.edificio.nombre,
    unidad: a.tarea.espacio.unidad.nombre,
    estado: a.estado,
    aprobador: a.aprobador.nombre,
    justificacion: a.justificacion_por_item
      ? JSON.stringify(a.justificacion_por_item)
      : null,
    fecha: a.fecha,
  }));
}

// Proyectos donde el contratista tiene tareas asignadas
export async function getContratistaProyectos(usuarioId: string) {
  const tareas = await prisma.tarea.findMany({
    where: { asignado_a: usuarioId },
    select: {
      espacio: {
        select: {
          unidad: {
            select: {
              piso: {
                select: {
                  edificio: {
                    select: {
                      proyecto: { select: { id: true, nombre: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    distinct: ["espacio_id"],
  });

  const proyectosMap = new Map<string, { id: string; nombre: string }>();
  for (const t of tareas) {
    const p = t.espacio.unidad.piso.edificio.proyecto;
    if (!proyectosMap.has(p.id)) {
      proyectosMap.set(p.id, p);
    }
  }

  return Array.from(proyectosMap.values());
}
