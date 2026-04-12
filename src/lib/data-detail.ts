import { prisma } from "@/lib/prisma";
import { calcularProgreso, calcularSemaforo, calcularDiasHabiles } from "@/lib/scoring";
import { getSignedEvidenciaUrl } from "@/lib/storage";

// Convierte un valor en url_storage (path o URL legacy) a una signed URL utilizable
async function resolveEvidenciaUrl(stored: string): Promise<string> {
  if (!stored) return "";
  // Legacy: ya es una URL pública completa
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    // Intentar extraer el path del URL público y generar signed URL
    const match = stored.match(/\/storage\/v1\/object\/public\/evidencias\/(.+)$/);
    if (match) {
      return await getSignedEvidenciaUrl(match[1]);
    }
    return stored;
  }
  // Path nuevo
  return await getSignedEvidenciaUrl(stored);
}

export async function getProyectoDetalle(proyectoId: string) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      fases: { orderBy: { orden: "asc" } },
      edificios: {
        orderBy: { nombre: "asc" },
        include: {
          pisos: {
            orderBy: { numero: "asc" },
            include: {
              unidades: {
                orderBy: { nombre: "asc" },
                include: {
                  tipo_unidad: true,
                  espacios: {
                    include: {
                      tareas: {
                        include: {
                          asignado_usuario: { select: { id: true, nombre: true } },
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

  const todasTareas = proyecto.edificios.flatMap((e) =>
    e.pisos.flatMap((pi) => pi.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas)))
  );
  const progreso = calcularProgreso(todasTareas);

  return { ...proyecto, progreso, totalTareas: todasTareas.length };
}

export async function getTareaDetalle(tareaId: string) {
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: {
      espacio: {
        include: {
          unidad: {
            include: { piso: { include: { edificio: { include: { proyecto: true } } } } },
          },
        },
      },
      fase: true,
      asignado_usuario: {
        select: {
          id: true,
          nombre: true,
          rol_ref: { select: { nombre: true, nivel_acceso: true } },
          contratista_perfil: { select: { id: true } },
        },
      },
      evidencias: { orderBy: { created_at: "desc" } },
      aprobaciones: {
        orderBy: { fecha: "desc" },
        include: { aprobador: { select: { nombre: true } } },
      },
      retrasos: { orderBy: { created_at: "desc" } },
      extensiones_tiempo: {
        orderBy: { fecha: "desc" },
        include: { autorizador: { select: { nombre: true } } },
      },
    },
  });
  if (!tarea) return null;

  // Generar signed URLs para las evidencias
  const evidenciasConUrl = await Promise.all(
    tarea.evidencias.map(async (e) => ({
      ...e,
      url_storage: await resolveEvidenciaUrl(e.url_storage),
    }))
  );

  // Generar signed URL para la foto de referencia si existe
  const fotoReferenciaSignedUrl = tarea.foto_referencia_url
    ? await resolveEvidenciaUrl(tarea.foto_referencia_url)
    : null;

  const proyecto = tarea.espacio.unidad.piso.edificio.proyecto;
  const inicio = tarea.fecha_inicio ?? tarea.created_at;
  const ahora = new Date();
  const diasTranscurridos = calcularDiasHabiles(inicio, ahora, proyecto.dias_habiles_semana);
  const semaforo = calcularSemaforo(tarea.tiempo_acordado_dias, diasTranscurridos, tarea.estado === "APROBADA");
  const diasRestantes = tarea.tiempo_acordado_dias - diasTranscurridos;

  return {
    ...tarea,
    evidencias: evidenciasConUrl,
    fotoReferenciaSignedUrl,
    proyecto,
    ubicacion: `${tarea.espacio.unidad.piso.edificio.nombre} · Piso ${tarea.espacio.unidad.piso.numero} · Apto ${tarea.espacio.unidad.nombre} · ${tarea.espacio.nombre}`,
    semaforo,
    diasTranscurridos,
    diasRestantes,
  };
}
