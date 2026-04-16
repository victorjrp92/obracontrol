import { prisma } from "@/lib/prisma";
import { calcularDiasHabiles, calcularSemaforo } from "@/lib/scoring";

export interface ObreroTarea {
  id: string;
  nombre: string;
  ubicacion: string;
  estado: string;
  semaforo: string;
  diasRestantes: number;
  reportadaPor: string | null;
  fotoReferenciaUrl: string | null;
}

/**
 * Fetch all tasks assigned to the obrero's contratista within the constructora.
 * Returns simplified data for the obrero view.
 */
export async function getObreroTareas(
  contratistaId: string,
  constructoraId: string
): Promise<ObreroTarea[]> {
  const ahora = new Date();

  const tareas = await prisma.tarea.findMany({
    where: {
      asignado_a: contratistaId,
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
      evidencias: {
        include: {
          obrero: { select: { nombre: true } },
        },
        orderBy: { created_at: "desc" },
        take: 1,
      },
    },
  });

  const resultado = tareas.map((t) => {
    const proyecto = t.espacio.unidad.piso.edificio.proyecto;
    const inicio = t.fecha_inicio ?? t.created_at;
    const dias = calcularDiasHabiles(inicio, ahora, proyecto.dias_habiles_semana);
    const semaforo = calcularSemaforo(
      t.tiempo_acordado_dias,
      dias,
      t.estado === "APROBADA"
    );
    const diasRestantes = t.tiempo_acordado_dias - dias;

    // Check if reported by an obrero
    const reportadaPor =
      t.evidencias.length > 0 && t.evidencias[0].obrero
        ? t.evidencias[0].obrero.nombre
        : null;

    return {
      id: t.id,
      nombre: t.nombre,
      ubicacion: `${t.espacio.unidad.piso.edificio.nombre} · Apto ${t.espacio.unidad.nombre}`,
      estado: t.estado,
      semaforo,
      diasRestantes,
      reportadaPor,
      fotoReferenciaUrl: t.foto_referencia_url,
    };
  });

  // Order: PENDIENTE first, then NO_APROBADA, then REPORTADA, then APROBADA
  const ordenEstado: Record<string, number> = {
    PENDIENTE: 0,
    NO_APROBADA: 1,
    REPORTADA: 2,
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

export interface ObreroTareaDetalle {
  id: string;
  nombre: string;
  ubicacion: string;
  estado: string;
  fotoReferenciaUrl: string | null;
  notas: string | null;
  evidencias: {
    id: string;
    tipo: string;
    url_storage: string;
    timestamp_captura: Date;
  }[];
  ultimaAprobacion: {
    estado: string;
    justificacion: string | null;
    fecha: Date;
  } | null;
}

/**
 * Fetch a single task with full details for the obrero view.
 * SECURITY: verifies task is assigned to the given contratista.
 */
export async function getObreroTareaDetalle(
  tareaId: string,
  contratistaId: string
): Promise<ObreroTareaDetalle | null> {
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: {
      espacio: {
        include: {
          unidad: {
            include: {
              piso: {
                include: {
                  edificio: true,
                },
              },
            },
          },
        },
      },
      evidencias: {
        orderBy: { timestamp_captura: "asc" },
        select: {
          id: true,
          tipo: true,
          url_storage: true,
          timestamp_captura: true,
        },
      },
      aprobaciones: {
        orderBy: { fecha: "desc" },
        take: 1,
      },
    },
  });

  if (!tarea) return null;

  // Security check: task must be assigned to this contratista
  if (tarea.asignado_a !== contratistaId) return null;

  const ultimaAprobacion = tarea.aprobaciones[0] ?? null;

  return {
    id: tarea.id,
    nombre: tarea.nombre,
    ubicacion: `${tarea.espacio.unidad.piso.edificio.nombre} · Apto ${tarea.espacio.unidad.nombre}`,
    estado: tarea.estado,
    fotoReferenciaUrl: tarea.foto_referencia_url,
    notas: tarea.notas,
    evidencias: tarea.evidencias,
    ultimaAprobacion: ultimaAprobacion
      ? {
          estado: ultimaAprobacion.estado,
          justificacion: ultimaAprobacion.justificacion_por_item
            ? JSON.stringify(ultimaAprobacion.justificacion_por_item)
            : null,
          fecha: ultimaAprobacion.fecha,
        }
      : null,
  };
}

/**
 * Validate an obrero token and return the obrero if valid.
 * Checks: exists, activo, date range.
 */
export async function validateObreroToken(token: string) {
  const obrero = await prisma.obrero.findUnique({
    where: { token },
    include: {
      contratista: { select: { id: true, nombre: true } },
    },
  });

  if (!obrero) return null;
  if (!obrero.activo) return null;

  const now = new Date();
  if (now < obrero.fecha_inicio || now > obrero.fecha_expiracion) return null;

  return obrero;
}
